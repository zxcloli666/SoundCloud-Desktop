use std::net::SocketAddr;
use std::time::Duration;

use sc_chat::{Tier, Transport, TransportError, TransportRequest};
use warp::Filter;
use warp::http::{Response, StatusCode};

use super::client::{ANSWER_MAX, gather, lost_on_the_way, seconds_to_ms};
use super::hops::Hop;
use super::{EdgeTransport, Route};
use crate::network::edge;

fn request(tier: Tier, timeout_ms: u64) -> TransportRequest {
    TransportRequest {
        tier,
        envelope: vec![1, 2, 3, 4],
        timeout_ms,
        long_poll: true,
    }
}

async fn serve(status: u16, retry_after: Option<&'static str>, delay: Duration) -> SocketAddr {
    let route = warp::post()
        .and(warp::path!("chat" / "x"))
        .and(warp::body::bytes())
        .then(move |body: warp::hyper::body::Bytes| async move {
            tokio::time::sleep(delay).await;
            let mut answer = Response::builder()
                .status(StatusCode::from_u16(status).unwrap())
                .header("content-type", "application/octet-stream");
            if let Some(seconds) = retry_after {
                answer = answer.header("retry-after", seconds);
            }
            let mut echoed = body.to_vec();
            echoed.reverse();
            answer.body(echoed).unwrap()
        });
    let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    addr
}

async fn serve_bytes(size: usize) -> SocketAddr {
    let route = warp::post().and(warp::path!("chat" / "x")).map(move || {
        Response::builder()
            .status(200)
            .body(vec![7u8; size])
            .unwrap()
    });
    let (addr, server) = warp::serve(route).bind_ephemeral(([127, 0, 0, 1], 0));
    tokio::spawn(server);
    addr
}

fn fixed(addr: SocketAddr) -> EdgeTransport {
    EdgeTransport::new(Route::fixed(&format!("http://{addr}")))
}

#[test]
fn the_edge_route_has_no_direct_hop_and_follows_the_api_plan() {
    edge::set_gateway(4321);
    let route = Route::edge();
    assert_eq!(route.tiers(), [Tier::Relay, Tier::Pro]);
    assert!(route.hops(Tier::Direct).is_empty());
    let relays = route.hops(Tier::Relay);
    assert!(!relays.is_empty());
    assert!(relays.iter().all(|hop| hop.0.ends_with("/chat/x")));
    assert!(relays.iter().all(|hop| hop.0.contains(".relay.scnative.")));
    let pros = route.hops(Tier::Pro);
    assert!(!pros.is_empty());
    assert!(
        pros.iter()
            .all(|hop| hop.0.starts_with("http://127.0.0.1:4321/pro/"))
    );
}

#[test]
fn a_fixed_dev_origin_is_direct_only() {
    let route = Route::fixed("http://127.0.0.1:3000/");
    assert_eq!(route.tiers(), [Tier::Direct]);
    assert_eq!(
        route.hops(Tier::Direct),
        [Hop("http://127.0.0.1:3000/chat/x".to_string())]
    );
    assert!(route.hops(Tier::Relay).is_empty());
}

#[test]
fn gateway_errors_without_retry_after_mean_the_hop_is_lost() {
    assert!(lost_on_the_way(421, None));
    assert!(lost_on_the_way(502, None));
    assert!(lost_on_the_way(504, None));
    assert!(!lost_on_the_way(503, Some(2_000)));
    assert!(!lost_on_the_way(200, None));
    assert!(!lost_on_the_way(400, None));
    assert_eq!(seconds_to_ms(" 3 "), Some(3_000));
    assert_eq!(seconds_to_ms("soon"), None);
}

#[tokio::test]
async fn an_answer_comes_back_whole_with_its_status() {
    let addr = serve(200, None, Duration::ZERO).await;
    let answer = fixed(addr)
        .exchange(request(Tier::Direct, 5_000))
        .await
        .unwrap();
    assert_eq!(answer.status, 200);
    assert_eq!(answer.body, [4, 3, 2, 1]);
    assert_eq!(answer.retry_after_ms, None);
}

#[tokio::test]
async fn busy_keeps_its_retry_after() {
    let addr = serve(503, Some("2"), Duration::ZERO).await;
    let answer = fixed(addr)
        .exchange(request(Tier::Direct, 5_000))
        .await
        .unwrap();
    assert_eq!(answer.status, 503);
    assert_eq!(answer.retry_after_ms, Some(2_000));
}

#[tokio::test]
async fn a_gateway_page_counts_as_unreachable() {
    let addr = serve(502, None, Duration::ZERO).await;
    let failed = fixed(addr).exchange(request(Tier::Direct, 5_000)).await;
    assert_eq!(failed, Err(TransportError::Unreachable));
}

#[tokio::test]
async fn a_slow_answer_times_out_at_the_deadline() {
    let addr = serve(200, None, Duration::from_secs(5)).await;
    let failed = fixed(addr).exchange(request(Tier::Direct, 300)).await;
    assert_eq!(failed, Err(TransportError::Timeout));
}

#[tokio::test]
async fn a_closed_port_is_unreachable() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);
    let failed = fixed(addr).exchange(request(Tier::Direct, 5_000)).await;
    assert_eq!(failed, Err(TransportError::Unreachable));
}

#[tokio::test]
async fn a_tier_the_route_lacks_is_unreachable() {
    let addr = serve(200, None, Duration::ZERO).await;
    let failed = fixed(addr).exchange(request(Tier::Relay, 5_000)).await;
    assert_eq!(failed, Err(TransportError::Unreachable));
}

#[tokio::test]
async fn an_answer_over_the_cap_is_dropped() {
    let addr = serve_bytes(ANSWER_MAX + 1).await;
    let failed = fixed(addr).exchange(request(Tier::Direct, 5_000)).await;
    assert_eq!(failed, Err(TransportError::Unreachable));
    let addr = serve_bytes(ANSWER_MAX).await;
    let answer = fixed(addr)
        .exchange(request(Tier::Direct, 5_000))
        .await
        .unwrap();
    assert_eq!(answer.body.len(), ANSWER_MAX);
}

#[tokio::test]
async fn a_stream_without_a_length_stops_at_the_cap() {
    let half = || Ok::<_, ()>(vec![0u8; ANSWER_MAX / 2]);
    let endless = futures_util::stream::iter([half(), half(), half()]);
    assert_eq!(
        gather(endless, |_| TransportError::Timeout).await,
        Err(TransportError::Unreachable)
    );
    let broken = futures_util::stream::iter([Ok(vec![1u8]), Err(())]);
    assert_eq!(
        gather(broken, |_| TransportError::Timeout).await,
        Err(TransportError::Timeout)
    );
    let small = futures_util::stream::iter([Ok::<_, ()>(vec![1u8, 2]), Ok(vec![3])]);
    assert_eq!(
        gather(small, |_| TransportError::Timeout).await,
        Ok(vec![1, 2, 3])
    );
}
