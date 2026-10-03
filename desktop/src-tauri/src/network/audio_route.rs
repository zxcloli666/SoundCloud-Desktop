use std::time::Duration;

use futures_util::stream::{FuturesUnordered, StreamExt};
use wreq::redirect::Policy;
use wreq::{Client, RequestBuilder, Response};

use super::edge::{self, Hop};

const HEDGE_DELAY: Duration = Duration::from_millis(300);
const ROUTE_SILENCE: Duration = Duration::from_secs(15);

pub async fn get_without_redirects(
    client: &Client,
    url: &str,
    session_id: Option<&str>,
) -> Result<(Response, Hop), String> {
    let mut hops = edge::audio_plan(url);
    let (response, at) =
        get_from_hops(client, &hops, session_id, HEDGE_DELAY, Some(Policy::none())).await?;
    Ok((response, hops.swap_remove(at)))
}

pub async fn get_in_order(
    client: &Client,
    url: &str,
    session_id: Option<&str>,
) -> Result<(Response, Hop), String> {
    let mut hops = edge::audio_plan(url);
    let (response, at) = first_answer(client, &hops, session_id).await?;
    Ok((response, hops.swap_remove(at)))
}

pub async fn first_answer(
    client: &Client,
    hops: &[Hop],
    session_id: Option<&str>,
) -> Result<(Response, usize), String> {
    get_from_hops(client, hops, session_id, ROUTE_SILENCE, None).await
}

async fn get_from_hops(
    client: &Client,
    hops: &[Hop],
    session_id: Option<&str>,
    hedge_after: Duration,
    redirects: Option<Policy>,
) -> Result<(Response, usize), String> {
    let send = |at: usize| {
        let mut request = request(client, &hops[at], session_id);
        if let Some(policy) = redirects.clone() {
            request = request.redirect(policy);
        }
        async move { (at, request.send().await) }
    };

    let mut attempts = FuturesUnordered::new();
    let mut errors = Vec::new();
    let mut next = 0;
    while next < hops.len() || !attempts.is_empty() {
        if attempts.is_empty() {
            attempts.push(send(next));
            next += 1;
        }
        tokio::select! {
            Some((at, result)) = attempts.next() => {
                if let Some(response) = settle(&hops[at], result, &mut errors) {
                    return Ok((response, at));
                }
            }
            () = tokio::time::sleep(hedge_after), if next < hops.len() => {
                attempts.push(send(next));
                next += 1;
            }
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

    use tokio::net::TcpListener;
    use warp::Filter;
    use wreq::redirect::Policy;

    use super::{ROUTE_SILENCE, first_answer, get_from_hops};
    use crate::network::edge::{Hop, Tier};

    fn hop(url: String, tier: Tier) -> Hop {
        Hop {
            url,
            tier,
            origin: String::new(),
        }
    }

    fn answering(body: &'static str) -> String {
        let (addr, server) =
            warp::serve(warp::path::end().map(move || body)).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(server);
        format!("http://{addr}")
    }

    async fn silent() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let mut held = Vec::new();
            while let Ok((socket, _)) = listener.accept().await {
                held.push(socket);
            }
        });
        format!("http://{addr}")
    }

    #[tokio::test]
    async fn hedge_uses_fast_alternate_without_waiting_for_slow_headers() {
        let slow = warp::path::end().and_then(|| async {
            tokio::time::sleep(Duration::from_secs(2)).await;
            Ok::<_, Infallible>("slow")
        });
        let (slow_addr, slow_server) = warp::serve(slow).bind_ephemeral(([127, 0, 0, 1], 0));
        tokio::spawn(slow_server);

        let hops = vec![
            hop(format!("http://{slow_addr}"), Tier::Direct),
            hop(answering("fast"), Tier::Relay),
        ];
        let started = Instant::now();
        let (response, at) = get_from_hops(
            &wreq::Client::new(),
            &hops,
            None,
            Duration::from_millis(40),
            Some(Policy::none()),
        )
        .await
        .unwrap();

        assert_eq!(hops[at].tier, Tier::Relay);
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
        let (response, _) = get_from_hops(
            &wreq::Client::new(),
            &hops,
            None,
            Duration::from_millis(40),
            Some(Policy::none()),
        )
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
        let (response, at) = first_answer(&wreq::Client::new(), &hops, None)
            .await
            .unwrap();

        assert_eq!(hops[at].tier, Tier::Direct);
        assert_eq!(response.text().await.unwrap(), "slow");
        assert_eq!(relay_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn the_relay_is_asked_at_once_when_the_direct_route_cannot_connect() {
        let hops = vec![
            hop("http://127.0.0.1:9".to_string(), Tier::Direct),
            hop(answering("relay"), Tier::Relay),
        ];
        let started = Instant::now();
        let (response, at) = first_answer(&wreq::Client::new(), &hops, None)
            .await
            .unwrap();

        assert_eq!(hops[at].tier, Tier::Relay);
        assert_eq!(response.text().await.unwrap(), "relay");
        assert!(started.elapsed() < ROUTE_SILENCE / 2);
    }

    #[tokio::test]
    async fn a_route_that_connects_and_stays_silent_is_hedged_by_the_next() {
        let silence = Duration::from_millis(300);
        let hops = vec![
            hop(silent().await, Tier::Direct),
            hop(answering("relay"), Tier::Relay),
        ];
        let started = Instant::now();
        let (response, at) = get_from_hops(&wreq::Client::new(), &hops, None, silence, None)
            .await
            .unwrap();

        assert_eq!(hops[at].tier, Tier::Relay);
        assert_eq!(response.text().await.unwrap(), "relay");
        assert!(started.elapsed() >= silence);
        assert!(started.elapsed() < silence * 4);
    }
}
