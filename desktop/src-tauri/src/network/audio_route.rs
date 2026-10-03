use std::future::Future;
use std::pin::Pin;
use std::time::Duration;

use futures_util::stream::{FuturesUnordered, StreamExt};
use wreq::redirect::Policy;
use wreq::{Client, RequestBuilder, Response};

use super::edge::{self, Hop};

const HEDGE_DELAY: Duration = Duration::from_millis(300);

type Attempt =
    Pin<Box<dyn Future<Output = (Hop, Result<Response, wreq::Error>)> + Send + 'static>>;

pub async fn get_without_redirects(
    client: &Client,
    url: &str,
    session_id: Option<&str>,
) -> Result<(Response, Hop), String> {
    get_from_hops(client, edge::audio_plan(url), session_id, HEDGE_DELAY).await
}

pub async fn get_in_order(
    client: &Client,
    url: &str,
    session_id: Option<&str>,
) -> Result<(Response, Hop), String> {
    get_from_hops_in_order(client, edge::audio_plan(url), session_id).await
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
            let result = request(&client, &hop, session_id.as_deref())
                .redirect(Policy::none())
                .send()
                .await;
            (hop, result)
        }));
    }

    let mut errors = Vec::new();
    while let Some((hop, result)) = attempts.next().await {
        if let Some(response) = settle(&hop, result, &mut errors) {
            return Ok((response, hop));
        }
    }
    Err(route_error(errors))
}

async fn get_from_hops_in_order(
    client: &Client,
    hops: Vec<Hop>,
    session_id: Option<&str>,
) -> Result<(Response, Hop), String> {
    let mut errors = Vec::new();
    for hop in hops {
        let result = request(client, &hop, session_id).send().await;
        if let Some(response) = settle(&hop, result, &mut errors) {
            return Ok((response, hop));
        }
    }
    Err(route_error(errors))
}

fn request(client: &Client, hop: &Hop, session_id: Option<&str>) -> RequestBuilder {
    let request = client.get(&hop.url);
    match session_id {
        Some(session_id) => request.header("x-session-id", session_id),
        None => request,
    }
}

fn settle(
    hop: &Hop,
    result: Result<Response, wreq::Error>,
    errors: &mut Vec<String>,
) -> Option<Response> {
    match result {
        Ok(response) if edge::hop_ok(hop, &response) => {
            hop.note(true);
            Some(response)
        }
        Ok(response) => {
            errors.push(format!("{}: HTTP {}", hop.tier_label(), response.status()));
            None
        }
        Err(error) => {
            hop.note(false);
            errors.push(format!("{}: {error}", hop.tier_label()));
            None
        }
    }
}

fn route_error(errors: Vec<String>) -> String {
    if errors.is_empty() {
        "no audio route".to_string()
    } else {
        errors.join("; ")
    }
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{Duration, Instant};

    use super::{get_from_hops, get_from_hops_in_order};
    use crate::network::edge::{Hop, Tier};
    use warp::Filter;

    fn hop(url: String, tier: Tier) -> Hop {
        Hop {
            url,
            tier,
            origin: String::new(),
        }
    }

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
            hop(format!("http://{slow_addr}"), Tier::Direct),
            hop(format!("http://{fast_addr}"), Tier::Relay),
        ];
        let started = Instant::now();
        let (response, hop) =
            get_from_hops(&wreq::Client::new(), hops, None, Duration::from_millis(40))
                .await
                .unwrap();

        assert_eq!(hop.tier, Tier::Relay);
        assert_eq!(response.text().await.unwrap(), "fast");
        assert!(started.elapsed() < Duration::from_secs(1));
    }

    #[tokio::test]
    async fn a_ticket_redirect_is_handed_back_instead_of_followed() {
        let ticket = "http://127.0.0.1:9/stream/urn?ticket=signed";
        let api = warp::path::end()
            .map(move || warp::redirect::temporary(warp::http::Uri::from_static(ticket)));
        let (addr, server) = warp::serve(api).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);

        let hops = vec![hop(format!("http://{addr}"), Tier::Direct)];
        let (response, _) =
            get_from_hops(&wreq::Client::new(), hops, None, Duration::from_millis(40))
                .await
                .unwrap();

        assert_eq!(response.status().as_u16(), 307);
        assert_eq!(response.headers()["location"], ticket);
    }

    #[tokio::test]
    async fn a_slow_stream_is_waited_for_instead_of_asked_twice() {
        let slow = warp::path::end().and_then(|| async {
            tokio::time::sleep(Duration::from_millis(600)).await;
            Ok::<_, Infallible>("slow")
        });
        let (slow_addr, slow_server) = warp::serve(slow).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(slow_server);

        let relay_calls = Arc::new(AtomicUsize::new(0));
        let counted = relay_calls.clone();
        let relay = warp::path::end().map(move || {
            counted.fetch_add(1, Ordering::SeqCst);
            "relay"
        });
        let (relay_addr, relay_server) = warp::serve(relay).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(relay_server);

        let hops = vec![
            hop(format!("http://{slow_addr}"), Tier::Direct),
            hop(format!("http://{relay_addr}"), Tier::Relay),
        ];
        let (response, hop) = get_from_hops_in_order(&wreq::Client::new(), hops, None)
            .await
            .unwrap();

        assert_eq!(hop.tier, Tier::Direct);
        assert_eq!(response.text().await.unwrap(), "slow");
        assert_eq!(relay_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn the_relay_is_asked_once_the_direct_route_cannot_connect() {
        let (relay_addr, relay_server) =
            warp::serve(warp::path::end().map(|| "relay")).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(relay_server);

        let hops = vec![
            hop("http://127.0.0.1:9".to_string(), Tier::Direct),
            hop(format!("http://{relay_addr}"), Tier::Relay),
        ];
        let (response, hop) = get_from_hops_in_order(&wreq::Client::new(), hops, None)
            .await
            .unwrap();

        assert_eq!(hop.tier, Tier::Relay);
        assert_eq!(response.text().await.unwrap(), "relay");
    }
}
