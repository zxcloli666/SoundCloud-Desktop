//! Hedged routing for audio control endpoints.
//!
//! `/download` is small JSON and `/stream` returns a large body. We race only the
//! response headers: the preferred direct/relay route gets a short head start,
//! then its alternate starts. As soon as one transport answers, the other future
//! is dropped before either audio body is consumed.

use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use futures_util::stream::{FuturesUnordered, StreamExt};
use reqwest::{Client, Response};

use super::edge::{self, Hop};

const HEDGE_DELAY: Duration = Duration::from_millis(300);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(6);

type Attempt = Pin<
    Box<dyn Future<Output = (Hop, Result<Response, String>)> + Send + 'static>,
>;

pub async fn get(
    client: &Client,
    url: &str,
    session_id: Option<&str>,
) -> Result<(Response, Hop), String> {
    get_from_hops(client, edge::audio_plan(url), session_id, HEDGE_DELAY).await
}

async fn get_from_hops(
    client: &Client,
    hops: Vec<Hop>,
    session_id: Option<&str>,
    hedge_delay: Duration,
) -> Result<(Response, Hop), String> {
    let mut attempts = FuturesUnordered::<Attempt>::new();
    for (index, hop) in hops.into_iter().enumerate() {
        let client = client.clone();
        let session_id = session_id.map(str::to_string);
        attempts.push(Box::pin(async move {
            if index > 0 {
                tokio::time::sleep(hedge_delay).await;
            }
            let mut request = client.get(&hop.url);
            if let Some(session_id) = session_id {
                request = request.header("x-session-id", session_id);
            }

            let result = match tokio::time::timeout(REQUEST_TIMEOUT, request.send()).await {
                Ok(result) => result.map_err(|error| error.to_string()),
                Err(_) => Err("audio route request timed out".to_string()),
            };
            (hop, result)
        }));
    }

    let mut errors = Vec::new();
    while let Some((hop, result)) = attempts.next().await {
        match result {
            Ok(response) if edge::hop_ok(&hop, &response) => {
                hop.note(true);
                return Ok((response, hop));
            }
            Ok(response) => {
                errors.push(format!("{}: HTTP {}", hop.tier_label(), response.status()));
            }
            Err(error) => {
                hop.note(false);
                errors.push(format!("{}: {error}", hop.tier_label()));
            }
        }
    }

    Err(if errors.is_empty() {
        "no audio route".to_string()
    } else {
        errors.join("; ")
    })
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::time::{Duration, Instant};

    use super::get_from_hops;
    use crate::network::edge::{Hop, Tier};
    use warp::Filter;

    #[tokio::test]
    async fn hedge_uses_fast_alternate_without_waiting_for_slow_headers() {
        let slow = warp::path::end().and_then(|| async {
            tokio::time::sleep(Duration::from_secs(2)).await;
            Ok::<_, Infallible>("slow")
        });
        let (slow_addr, slow_server) = warp::serve(slow).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(slow_server);

        let (fast_addr, fast_server) =
            warp::serve(warp::path::end().map(|| "fast")).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(fast_server);

        let hops = vec![
            Hop {
                url: format!("http://{slow_addr}"),
                tier: Tier::Direct,
                origin: String::new(),
            },
            Hop {
                url: format!("http://{fast_addr}"),
                tier: Tier::Relay,
                origin: String::new(),
            },
        ];
        let started = Instant::now();
        let (response, hop) = get_from_hops(
            &reqwest::Client::new(),
            hops,
            None,
            Duration::from_millis(40),
        )
        .await
        .unwrap();

        assert_eq!(hop.tier, Tier::Relay);
        assert_eq!(response.text().await.unwrap(), "fast");
        assert!(started.elapsed() < Duration::from_secs(1));
    }
}
