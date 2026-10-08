use std::error::Error;
use std::net::IpAddr;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::Duration;

use futures_util::FutureExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

use super::doh::DohAnswer;
use super::{Config, DnsError, Fallback, Lookup, Scope, not_found, scope};
use crate::network::fail::{Fail, FailKind, of_wreq};

const BUDGET: Duration = Duration::from_millis(300);

fn ip(text: &str) -> IpAddr {
    text.parse().unwrap()
}

fn ips(texts: &[&str]) -> Vec<IpAddr> {
    texts.iter().map(|text| ip(text)).collect()
}

fn known(host: &str) -> bool {
    matches!(
        host,
        "api.scnative.space" | "images.scnative.space" | "status.soundcloud-desktop.fun"
    )
}

fn zone() -> Vec<String> {
    vec!["images.scnative.space".to_string()]
}

#[derive(Clone, Default)]
struct Calls(Arc<AtomicUsize>);

impl Calls {
    fn count(&self) -> usize {
        self.0.load(Ordering::SeqCst)
    }
}

fn system(result: Result<Vec<IpAddr>, Fail>, delay_ms: u64, calls: &Calls) -> Lookup<Vec<IpAddr>> {
    let calls = calls.clone();
    Arc::new(move |_| {
        let result = result.clone();
        let calls = calls.clone();
        async move {
            calls.0.fetch_add(1, Ordering::SeqCst);
            tokio::time::sleep(Duration::from_millis(delay_ms)).await;
            result
        }
        .boxed()
    })
}

fn doh(result: Result<Vec<IpAddr>, Fail>, ttl: u32, calls: &Calls) -> Lookup<DohAnswer> {
    let calls = calls.clone();
    Arc::new(move |_| {
        let result = result.clone();
        let calls = calls.clone();
        async move {
            calls.0.fetch_add(1, Ordering::SeqCst);
            result.map(|addrs| DohAnswer {
                addrs,
                ttl,
                provider: "test",
            })
        }
        .boxed()
    })
}

fn switched(
    up: &Arc<AtomicBool>,
    addrs: Vec<IpAddr>,
    ttl: u32,
    calls: &Calls,
) -> Lookup<DohAnswer> {
    let up = up.clone();
    let calls = calls.clone();
    Arc::new(move |_| {
        calls.0.fetch_add(1, Ordering::SeqCst);
        let answer = DohAnswer {
            addrs: addrs.clone(),
            ttl,
            provider: "test",
        };
        let result = if up.load(Ordering::SeqCst) {
            Ok(answer)
        } else {
            Err(Fail::timeout_after(3000))
        };
        async move { result }.boxed()
    })
}

fn nxdomain() -> Result<Vec<IpAddr>, Fail> {
    Ok(Vec::new())
}

fn temporary() -> Result<Vec<IpAddr>, Fail> {
    Err(Fail::of(FailKind::Dns))
}

fn system_by(
    table: Vec<(&'static str, Result<Vec<IpAddr>, Fail>)>,
    calls: &Calls,
) -> Lookup<Vec<IpAddr>> {
    let calls = calls.clone();
    Arc::new(move |host| {
        calls.0.fetch_add(1, Ordering::SeqCst);
        let result = table
            .iter()
            .find(|(name, _)| *name == host)
            .map_or_else(nxdomain, |(_, result)| result.clone());
        async move { result }.boxed()
    })
}

fn distrusted(resolver: &Fallback) -> bool {
    resolver.distrusted(tokio::time::Instant::now())
}

fn fallback(system: Lookup<Vec<IpAddr>>, doh: Lookup<DohAnswer>) -> Fallback {
    Fallback::new(Config {
        system,
        doh,
        system_budget: BUDGET,
        known,
        zone,
    })
}

async fn server() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        loop {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            tokio::spawn(async move {
                let mut buf = [0u8; 1024];
                let _ = socket.read(&mut buf).await;
                let _ = socket
                    .write_all(
                        b"HTTP/1.1 200 OK\r\ncontent-length: 2\r\nconnection: close\r\n\r\nok",
                    )
                    .await;
            });
        }
    });
    port
}

async fn fetch(resolver: &Fallback, host: &str, port: u16) -> Result<String, wreq::Error> {
    let client = wreq::Client::builder()
        .no_proxy()
        .dns_resolver(Arc::new(resolver.clone()))
        .connect_timeout(Duration::from_secs(2))
        .build()
        .unwrap();
    client
        .get(format!("http://{host}:{port}/health"))
        .send()
        .await?
        .text()
        .await
}

#[test]
fn names_fall_into_local_ours_and_foreign() {
    for host in [
        "localhost",
        "nas.local",
        "printer",
        "10.0.0.1",
        "[::1]",
        "router.lan",
        "a.home.arpa",
    ] {
        assert_eq!(scope(host), Scope::Local, "{host}");
    }
    for host in [
        "api.scnative.space",
        "api.r1.relay.scnative.space",
        "scnative.space",
        "status.soundcloud-desktop.fun",
    ] {
        assert_eq!(scope(host), Scope::Ours, "{host}");
    }
    for host in [
        "soundcloud.com",
        "evilscnative.space",
        "scnative.space.example",
    ] {
        assert_eq!(scope(host), Scope::Foreign, "{host}");
    }
}

#[tokio::test]
async fn a_garbage_answer_falls_back_to_doh_and_is_cached() {
    let port = server().await;
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let resolver = fallback(
        system(Ok(ips(&["0.0.0.0"])), 0, &sys_calls),
        doh(Ok(ips(&["127.0.0.1"])), 60, &doh_calls),
    );
    let host = "status.soundcloud-desktop.fun";
    assert_eq!(fetch(&resolver, host, port).await.unwrap(), "ok");
    assert_eq!(fetch(&resolver, host, port).await.unwrap(), "ok");
    assert_eq!(sys_calls.count(), 1);
    assert_eq!(resolver.lookup(host).await.unwrap(), ips(&["127.0.0.1"]));
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        doh_calls.count(),
        2,
        "one lookup and one warm-up of the zone"
    );
}

#[tokio::test]
async fn a_known_name_without_an_answer_asks_doh() {
    let port = server().await;
    for answer in [nxdomain(), temporary()] {
        let resolver = fallback(
            system(answer, 0, &Calls::default()),
            doh(Ok(ips(&["127.0.0.1"])), 60, &Calls::default()),
        );
        assert_eq!(
            fetch(&resolver, "api.scnative.space", port).await.unwrap(),
            "ok"
        );
    }
}

#[tokio::test]
async fn nxdomain_for_an_unknown_name_of_ours_is_the_truth() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system(nxdomain(), 0, &Calls::default()),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    let error = resolver
        .lookup("nx-5d1c.relay.scnative.space")
        .await
        .unwrap_err();
    assert_eq!(error.kind, FailKind::Dns);
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test]
async fn nxdomain_for_a_foreign_name_is_the_truth() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system(nxdomain(), 0, &Calls::default()),
        doh(Ok(ips(&["1.2.3.4"])), 60, &doh_calls),
    );
    assert!(resolver.lookup("soundcloud.com").await.is_err());
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test]
async fn a_foreign_name_pointing_at_zero_asks_doh() {
    let port = server().await;
    let resolver = fallback(
        system(Ok(ips(&["0.0.0.0"])), 0, &Calls::default()),
        doh(Ok(ips(&["127.0.0.1"])), 60, &Calls::default()),
    );
    assert_eq!(fetch(&resolver, "example.com", port).await.unwrap(), "ok");
}

#[tokio::test]
async fn a_sane_answer_never_asks_doh() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system(
            Ok(ips(&["0.0.0.0", "188.165.221.195"])),
            0,
            &Calls::default(),
        ),
        doh(Ok(ips(&["1.2.3.4"])), 60, &doh_calls),
    );
    for host in [
        "api.scnative.space",
        "api.r9.relay.scnative.space",
        "soundcloud.com",
    ] {
        assert_eq!(
            resolver.lookup(host).await.unwrap(),
            ips(&["188.165.221.195"])
        );
    }
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test]
async fn a_local_name_never_asks_doh() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system(Ok(ips(&["127.0.0.1"])), 0, &Calls::default()),
        doh(Ok(ips(&["1.2.3.4"])), 60, &doh_calls),
    );
    assert_eq!(
        resolver.lookup("localhost").await.unwrap(),
        ips(&["127.0.0.1"])
    );
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test]
async fn a_hanging_system_resolver_gives_way_to_doh_within_a_second() {
    let port = server().await;
    let resolver = fallback(
        system(Ok(ips(&["127.0.0.1"])), 5_000, &Calls::default()),
        doh(Ok(ips(&["127.0.0.1"])), 60, &Calls::default()),
    );
    let started = std::time::Instant::now();
    assert_eq!(
        fetch(&resolver, "api.scnative.space", port).await.unwrap(),
        "ok"
    );
    assert!(
        started.elapsed() < Duration::from_secs(1),
        "{:?}",
        started.elapsed()
    );
}

#[tokio::test]
async fn a_timeout_for_an_unknown_name_of_ours_also_asks_doh() {
    let resolver = fallback(
        system(nxdomain(), 5_000, &Calls::default()),
        doh(Ok(ips(&["188.165.221.195"])), 60, &Calls::default()),
    );
    let found = resolver.lookup("r9.relay.scnative.space").await.unwrap();
    assert_eq!(found, ips(&["188.165.221.195"]));
}

fn dns_error_in(error: &wreq::Error) -> Option<DnsError> {
    let mut source = error.source();
    while let Some(cause) = source {
        if let Some(found) = cause.downcast_ref::<DnsError>() {
            return Some(found.clone());
        }
        source = cause.source();
    }
    None
}

#[tokio::test]
async fn when_both_fail_the_request_carries_a_dns_error() {
    let port = server().await;
    let blocked = Err(Fail::of(FailKind::Reset));
    let resolver = fallback(
        system(nxdomain(), 0, &Calls::default()),
        doh(blocked.clone(), 60, &Calls::default()),
    );
    let error = fetch(&resolver, "api.scnative.space", port)
        .await
        .unwrap_err();
    assert_eq!(of_wreq(&error), FailKind::Dns);
    let found = dns_error_in(&error).expect("dns error in the source chain");
    assert_eq!(found.host, "api.scnative.space");
    assert!(found.reason.contains("reset"), "{}", found.reason);

    let resolver = fallback(
        system(Ok(ips(&["2.26.93.81"])), 0, &Calls::default()),
        doh(blocked, 60, &Calls::default()),
    );
    let error = fetch(&resolver, "api.scnative.space", port)
        .await
        .unwrap_err();
    assert_eq!(of_wreq(&error), FailKind::DnsBogus);
}

#[tokio::test]
async fn a_doh_answer_drops_only_unspecified_addresses() {
    let resolver = fallback(
        system(nxdomain(), 0, &Calls::default()),
        doh(
            Ok(ips(&["0.0.0.0", "10.0.0.7", "188.165.221.195", "1.2.3.4"])),
            60,
            &Calls::default(),
        ),
    );
    let found = resolver.lookup("api.scnative.space").await.unwrap();
    assert_eq!(found, ips(&["10.0.0.7", "188.165.221.195"]));
}

#[tokio::test]
async fn concurrent_lookups_share_one_flight() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let resolver = fallback(
        system(Ok(ips(&["0.0.0.0"])), 50, &sys_calls),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    let lookups = (0..8).map(|_| resolver.lookup("example.com"));
    let found = futures_util::future::join_all(lookups).await;
    let expected = ips(&["188.165.221.195"]);
    assert!(
        found
            .iter()
            .all(|addrs| addrs.as_ref().ok() == Some(&expected))
    );
    assert_eq!((sys_calls.count(), doh_calls.count()), (1, 1));
}

#[tokio::test]
async fn a_garbage_answer_for_a_known_host_moves_the_zone_to_doh() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let resolver = fallback(
        system(Ok(ips(&["2.26.93.81"])), 0, &sys_calls),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    let expected = ips(&["188.165.221.195"]);
    assert_eq!(
        resolver.lookup("api.scnative.space").await.unwrap(),
        expected
    );
    let found = resolver.lookup("status.soundcloud-desktop.fun").await;
    assert_eq!(found.unwrap(), expected);
    assert_eq!(
        sys_calls.count(),
        1,
        "the distrusted zone skips the system resolver"
    );
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        resolver.lookup("images.scnative.space").await.unwrap(),
        expected
    );
    assert_eq!(
        doh_calls.count(),
        3,
        "the warm-up already cached the rest of the zone"
    );
}

async fn suspicion(resolver: &Fallback, host: &str) -> bool {
    match resolver.suspicion_due(host) {
        Some(system) => resolver.confirm(host, system).await,
        None => false,
    }
}

#[tokio::test]
async fn a_disjoint_doh_answer_moves_the_zone_to_doh() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let resolver = fallback(
        system(Ok(ips(&["2.26.99.107"])), 0, &sys_calls),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    assert_eq!(
        resolver.lookup("api.scnative.space").await.unwrap(),
        ips(&["2.26.99.107"])
    );
    assert!(suspicion(&resolver, "api.scnative.space").await);
    assert_eq!(
        resolver.lookup("api.scnative.space").await.unwrap(),
        ips(&["188.165.221.195"])
    );
    assert_eq!(
        resolver
            .lookup("status.soundcloud-desktop.fun")
            .await
            .unwrap(),
        ips(&["188.165.221.195"])
    );
    assert_eq!(
        sys_calls.count(),
        1,
        "the distrusted zone skips the system resolver"
    );
    assert!(!suspicion(&resolver, "api.scnative.space").await);
}

#[tokio::test]
async fn a_distrusted_zone_still_uses_a_sane_system_answer_when_doh_is_down() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let doh_up = Arc::new(AtomicBool::new(true));
    let resolver = fallback(
        system(Ok(ips(&["2.26.99.107"])), 0, &sys_calls),
        switched(&doh_up, ips(&["188.165.221.195"]), 60, &doh_calls),
    );
    resolver.lookup("api.scnative.space").await.unwrap();
    assert!(suspicion(&resolver, "api.scnative.space").await);
    doh_up.store(false, Ordering::SeqCst);
    let found = resolver.lookup("status.soundcloud-desktop.fun").await;
    assert_eq!(found.unwrap(), ips(&["2.26.99.107"]));
    assert_eq!(sys_calls.count(), 2);
}

#[tokio::test]
async fn an_equal_doh_answer_changes_nothing() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let resolver = fallback(
        system(Ok(ips(&["188.165.221.195"])), 0, &sys_calls),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    resolver.lookup("api.scnative.space").await.unwrap();
    assert!(!suspicion(&resolver, "api.scnative.space").await);
    assert_eq!(doh_calls.count(), 1);
    assert!(!suspicion(&resolver, "api.scnative.space").await);
    assert_eq!(doh_calls.count(), 1, "one check per five minutes");
    resolver.lookup("images.scnative.space").await.unwrap();
    assert_eq!(sys_calls.count(), 2);
}

#[tokio::test]
async fn a_fake_ip_tunnel_or_an_unknown_name_is_never_suspected() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system(Ok(ips(&["198.18.0.42"])), 0, &Calls::default()),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    resolver.lookup("api.scnative.space").await.unwrap();
    resolver
        .lookup("api.r9.relay.scnative.space")
        .await
        .unwrap();
    assert!(!suspicion(&resolver, "api.scnative.space").await);
    assert!(!suspicion(&resolver, "api.r9.relay.scnative.space").await);
    assert!(!suspicion(&resolver, "images.scnative.space").await);
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test(start_paused = true)]
async fn a_cached_answer_lives_a_clamped_ttl_and_then_serves_as_stale() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let doh_up = Arc::new(AtomicBool::new(true));
    let resolver = fallback(
        system(Ok(ips(&["0.0.0.0"])), 0, &sys_calls),
        switched(&doh_up, ips(&["188.165.221.195"]), 5, &doh_calls),
    );
    let host = "example.com";
    let expected = ips(&["188.165.221.195"]);
    assert_eq!(resolver.lookup(host).await.unwrap(), expected);
    tokio::time::advance(Duration::from_secs(59)).await;
    assert_eq!(resolver.lookup(host).await.unwrap(), expected);
    assert_eq!((sys_calls.count(), doh_calls.count()), (1, 1));

    doh_up.store(false, Ordering::SeqCst);
    tokio::time::advance(Duration::from_secs(2)).await;
    assert_eq!(resolver.lookup(host).await.unwrap(), expected);
    assert_eq!((sys_calls.count(), doh_calls.count()), (2, 2));
    tokio::time::advance(Duration::from_secs(5)).await;
    assert_eq!(resolver.lookup(host).await.unwrap(), expected);
    assert_eq!(
        doh_calls.count(),
        2,
        "a failed DoH is not asked again for 15 s"
    );

    tokio::time::advance(Duration::from_secs(3600)).await;
    let error = resolver.lookup(host).await.unwrap_err();
    assert_eq!(error.kind, FailKind::DnsBogus);
}

#[test]
fn only_a_definitive_resolver_answer_counts_as_no_such_name() {
    let table = [
        (std::io::Error::from_raw_os_error(11001), true),
        (std::io::Error::from_raw_os_error(11004), true),
        (std::io::Error::from_raw_os_error(11002), false),
        (
            std::io::Error::other(
                "failed to lookup address information: Name or service not known",
            ),
            true,
        ),
        (
            std::io::Error::other(
                "failed to lookup address information: No address associated with hostname",
            ),
            true,
        ),
        (
            std::io::Error::other("nodename nor servname provided, or not known"),
            true,
        ),
        (
            std::io::Error::other(
                "failed to lookup address information: Temporary failure in name resolution",
            ),
            false,
        ),
        (std::io::Error::from(std::io::ErrorKind::TimedOut), false),
    ];
    for (error, expected) in table {
        assert_eq!(not_found(&error), expected, "{error}");
    }
}

#[tokio::test]
async fn a_temporary_failure_uses_doh_once_and_keeps_trusting_the_zone() {
    let (sys_calls, doh_calls) = (Calls::default(), Calls::default());
    let resolver = fallback(
        system(temporary(), 0, &sys_calls),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    let found = resolver.lookup("api.scnative.space").await.unwrap();
    assert_eq!(found, ips(&["188.165.221.195"]));
    assert!(!distrusted(&resolver));
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(doh_calls.count(), 1, "no warm-up of the zone");
}

#[tokio::test]
async fn a_slow_resolver_uses_doh_once_and_keeps_trusting_the_zone() {
    let resolver = fallback(
        system(Ok(ips(&["188.165.221.195"])), 5_000, &Calls::default()),
        doh(Ok(ips(&["188.165.221.195"])), 60, &Calls::default()),
    );
    resolver.lookup("api.scnative.space").await.unwrap();
    assert!(!distrusted(&resolver));
}

#[tokio::test]
async fn a_name_both_resolvers_deny_never_distrusts_the_zone() {
    let resolver = fallback(
        system(nxdomain(), 0, &Calls::default()),
        doh(Ok(Vec::new()), 60, &Calls::default()),
    );
    let error = resolver.lookup("api.scnative.space").await.unwrap_err();
    assert_eq!(error.kind, FailKind::Dns);
    assert!(!distrusted(&resolver));
}

#[tokio::test]
async fn a_name_the_system_denies_but_doh_knows_distrusts_the_zone() {
    let resolver = fallback(
        system(nxdomain(), 0, &Calls::default()),
        doh(Ok(ips(&["188.165.221.195"])), 60, &Calls::default()),
    );
    resolver.lookup("api.scnative.space").await.unwrap();
    assert!(distrusted(&resolver));
}

#[tokio::test]
async fn a_foreign_name_keeps_a_private_or_local_answer_without_doh() {
    let doh_calls = Calls::default();
    for answer in [
        "10.0.0.5",
        "192.168.1.10",
        "127.0.0.1",
        "fc00::5",
        "100.64.0.1",
    ] {
        let resolver = fallback(
            system(Ok(ips(&[answer])), 0, &Calls::default()),
            doh(Ok(ips(&["1.2.3.4"])), 60, &doh_calls),
        );
        let found = resolver.lookup("proxy.corp.example").await.unwrap();
        assert_eq!(found, ips(&[answer]));
    }
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test]
async fn a_foreign_name_pointing_at_a_sinkhole_asks_doh() {
    let resolver = fallback(
        system(Ok(ips(&["2.26.93.81"])), 0, &Calls::default()),
        doh(Ok(ips(&["1.2.3.4"])), 60, &Calls::default()),
    );
    assert_eq!(
        resolver.lookup("example.com").await.unwrap(),
        ips(&["1.2.3.4"])
    );
}

async fn proxy_server() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    tokio::spawn(async move {
        let Ok((mut socket, _)) = listener.accept().await else {
            return;
        };
        let mut buf = [0u8; 2048];
        let read = socket.read(&mut buf).await.unwrap_or(0);
        let line = String::from_utf8_lossy(&buf[..read]).to_string();
        let body = if line.starts_with("GET http://target.example/health") {
            "proxied"
        } else {
            "wrong"
        };
        let reply = format!(
            "HTTP/1.1 200 OK\r\ncontent-length: {}\r\nconnection: close\r\n\r\n{body}",
            body.len()
        );
        let _ = socket.write_all(reply.as_bytes()).await;
    });
    port
}

#[tokio::test]
async fn a_proxy_on_a_private_name_still_carries_the_request() {
    let port = proxy_server().await;
    let doh_calls = Calls::default();
    let resolver = fallback(
        system_by(
            vec![("proxy.corp.example", Ok(ips(&["127.0.0.1"])))],
            &Calls::default(),
        ),
        doh(Ok(ips(&["1.2.3.4"])), 60, &doh_calls),
    );
    let client = wreq::Client::builder()
        .dns_resolver(Arc::new(resolver))
        .proxy(wreq::Proxy::all(format!("http://proxy.corp.example:{port}")).unwrap())
        .build()
        .unwrap();
    let body = client
        .get("http://target.example/health")
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();
    assert_eq!(body, "proxied");
    assert_eq!(doh_calls.count(), 0);
}

#[tokio::test]
async fn a_host_the_system_tunnels_keeps_its_fake_ip_while_the_zone_is_distrusted() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system_by(
            vec![
                ("status.soundcloud-desktop.fun", Ok(ips(&["198.18.0.42"]))),
                ("api.scnative.space", Ok(ips(&["2.26.93.81"]))),
            ],
            &Calls::default(),
        ),
        doh(Ok(ips(&["188.165.221.195"])), 60, &doh_calls),
    );
    let tunnel = ips(&["198.18.0.42"]);
    let host = "status.soundcloud-desktop.fun";
    assert_eq!(resolver.lookup(host).await.unwrap(), tunnel);
    resolver.lookup("api.scnative.space").await.unwrap();
    assert!(distrusted(&resolver));
    assert_eq!(resolver.lookup(host).await.unwrap(), tunnel);
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert_eq!(
        doh_calls.count(),
        2,
        "one lookup and one warm-up of images, never the tunnelled host"
    );
}

fn stepped_doh(addrs: Vec<IpAddr>, calls: &Calls) -> Lookup<DohAnswer> {
    let calls = calls.clone();
    Arc::new(move |_| {
        let addrs = addrs.clone();
        let calls = calls.clone();
        async move {
            calls.0.fetch_add(1, Ordering::SeqCst);
            let steps = async {
                tokio::time::sleep(Duration::from_millis(150)).await;
                tokio::time::sleep(Duration::from_millis(150)).await;
            };
            tokio::time::timeout(Duration::from_secs(1), steps)
                .await
                .map_err(|_| Fail::timeout_after(1000))?;
            Ok(DohAnswer {
                addrs,
                ttl: 60,
                provider: "test",
            })
        }
        .boxed()
    })
}

#[tokio::test(start_paused = true)]
async fn an_abandoned_lookup_still_finishes_for_the_next_caller() {
    let doh_calls = Calls::default();
    let resolver = fallback(
        system(temporary(), 0, &Calls::default()),
        stepped_doh(ips(&["188.165.221.195"]), &doh_calls),
    );
    let host = "api.scnative.space";
    let abandoned = tokio::time::timeout(Duration::from_millis(100), resolver.lookup(host)).await;
    assert!(abandoned.is_err());
    tokio::time::sleep(Duration::from_millis(1_500)).await;
    let expected = ips(&["188.165.221.195"]);
    assert_eq!(resolver.lookup(host).await.unwrap(), expected);
    assert_eq!(resolver.lookup(host).await.unwrap(), expected);
    assert_eq!(doh_calls.count(), 1);
}

#[tokio::test(start_paused = true)]
async fn a_slow_but_sane_system_answer_wins_when_doh_is_down() {
    let resolver = fallback(
        system(Ok(ips(&["188.165.221.195"])), 600, &Calls::default()),
        doh(Err(Fail::timeout_after(3000)), 60, &Calls::default()),
    );
    let found = resolver.lookup("api.scnative.space").await.unwrap();
    assert_eq!(found, ips(&["188.165.221.195"]));
}

#[tokio::test(start_paused = true)]
async fn a_system_resolver_gets_eight_seconds_when_doh_is_down() {
    let resolver = fallback(
        system(Ok(ips(&["188.165.221.195"])), 10_000, &Calls::default()),
        doh(Err(Fail::timeout_after(3000)), 60, &Calls::default()),
    );
    let started = tokio::time::Instant::now();
    let error = resolver.lookup("api.scnative.space").await.unwrap_err();
    assert_eq!(error.kind, FailKind::Dns);
    let waited = started.elapsed();
    assert!(waited >= Duration::from_secs(8), "{waited:?}");
    assert!(waited < Duration::from_secs(9), "{waited:?}");
}
