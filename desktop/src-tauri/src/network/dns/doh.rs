use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::OnceLock;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use futures_util::FutureExt;
use futures_util::stream::{FuturesUnordered, StreamExt};
use tokio::time::Instant;

use super::fallback::{listed, usable};
use super::{normalize, scope, wire};
use crate::network::fail::{Fail, FailKind};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(6);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(9);
const HEDGE_AFTER: Duration = Duration::from_millis(700);
const HEDGE_WIDTH: usize = 3;
pub const TOTAL_BUDGET: Duration = Duration::from_secs(10);
const MEDIA_TYPE: &str = "application/dns-message";

pub struct Provider {
    pub id: &'static str,
    pub name: &'static str,
    pub ips: [IpAddr; 2],
}

const fn v4(a: u8, b: u8, c: u8, d: u8) -> IpAddr {
    IpAddr::V4(Ipv4Addr::new(a, b, c, d))
}

pub const PROVIDERS: [Provider; 5] = [
    Provider {
        id: "cloudflare",
        name: "one.one.one.one",
        ips: [v4(1, 1, 1, 1), v4(1, 0, 0, 1)],
    },
    Provider {
        id: "google",
        name: "dns.google",
        ips: [v4(8, 8, 8, 8), v4(8, 8, 4, 4)],
    },
    Provider {
        id: "quad9",
        name: "dns.quad9.net",
        ips: [v4(9, 9, 9, 9), v4(149, 112, 112, 112)],
    },
    Provider {
        id: "adguard",
        name: "dns.adguard-dns.com",
        ips: [v4(94, 140, 14, 14), v4(94, 140, 15, 15)],
    },
    Provider {
        id: "yandex",
        name: "common.dot.dns.yandex.net",
        ips: [v4(77, 88, 8, 8), v4(77, 88, 8, 1)],
    },
];

static PREFERRED: AtomicUsize = AtomicUsize::new(0);
static CLIENT: OnceLock<Option<wreq::Client>> = OnceLock::new();

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DohAnswer {
    pub addrs: Vec<IpAddr>,
    pub ttl: u32,
    pub provider: &'static str,
}

fn build_client() -> Option<wreq::Client> {
    let mut builder = sc_fingerprint::builder(None).no_proxy();
    for provider in &PROVIDERS {
        let addrs = provider.ips.iter().map(|ip| SocketAddr::new(*ip, 443));
        builder = builder.resolve_to_addrs(provider.name, addrs);
    }
    configured(builder).build().ok()
}

fn configured(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    builder
        .http2_only()
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
}

fn client() -> Option<&'static wreq::Client> {
    CLIENT.get_or_init(build_client).as_ref()
}

fn failure(kind: FailKind, detail: impl Into<String>) -> Fail {
    Fail {
        detail: Some(detail.into()),
        ..Fail::of(kind)
    }
}

pub async fn query(host: &str) -> Result<DohAnswer, Fail> {
    let first = PREFERRED.load(Ordering::Relaxed);
    let (index, answer) = race(first, |index| async move {
        query_with(&PROVIDERS[index], host)
            .await
            .and_then(|answer| sane(host, answer))
    })
    .await?;
    PREFERRED.store(index, Ordering::Relaxed);
    Ok(answer)
}

pub fn sane(host: &str, answer: DohAnswer) -> Result<DohAnswer, Fail> {
    let addrs = usable(scope(&normalize(host)), &answer.addrs);
    if addrs.is_empty() && !answer.addrs.is_empty() {
        let detail = format!("{} answered {}", answer.provider, listed(&answer.addrs));
        return Err(failure(FailKind::DnsBogus, detail));
    }
    Ok(DohAnswer { addrs, ..answer })
}

async fn race<T, F, Fut>(first: usize, attempt: F) -> Result<(usize, T), Fail>
where
    F: Fn(usize) -> Fut,
    Fut: Future<Output = Result<T, Fail>>,
{
    let order: Vec<usize> = (0..HEDGE_WIDTH)
        .map(|step| (first + step) % PROVIDERS.len())
        .collect();
    tokio::time::timeout(TOTAL_BUDGET, hedged(&order, HEDGE_AFTER, attempt))
        .await
        .unwrap_or_else(|_| Err(Fail::timeout_after(TOTAL_BUDGET.as_millis() as u32)))
}

pub async fn query_with(provider: &'static Provider, host: &str) -> Result<DohAnswer, Fail> {
    let client = client().ok_or_else(|| failure(FailKind::Other, "no doh client"))?;
    let query = wire::build_query(host).ok_or_else(|| failure(FailKind::Dns, "bad name"))?;
    let url = wire::query_url(&format!("https://{}/dns-query", provider.name), &query);
    let response = client
        .get(url)
        .header(wreq::header::ACCEPT, MEDIA_TYPE)
        .send()
        .await
        .map_err(|error| Fail::of_wreq(&error))?;
    let status = response.status().as_u16();
    let body = response
        .bytes()
        .await
        .map_err(|error| Fail::of_wreq(&error))?;
    answer_of(provider, status, &body)
}

fn answer_of(provider: &Provider, status: u16, body: &[u8]) -> Result<DohAnswer, Fail> {
    if status != 200 {
        return Err(failure(FailKind::Status, format!("http {status}")));
    }
    let answer =
        wire::parse_response(body).ok_or_else(|| failure(FailKind::Other, "malformed answer"))?;
    let addrs = match answer.rcode {
        wire::RCODE_OK => answer.addrs,
        wire::RCODE_NXDOMAIN => Vec::new(),
        rcode => return Err(failure(FailKind::Dns, format!("rcode {rcode}"))),
    };
    Ok(DohAnswer {
        addrs,
        ttl: answer.ttl,
        provider: provider.id,
    })
}

async fn hedged<T, F, Fut>(order: &[usize], step: Duration, attempt: F) -> Result<(usize, T), Fail>
where
    F: Fn(usize) -> Fut,
    Fut: Future<Output = Result<T, Fail>>,
{
    let mut pending = order.iter().copied();
    let mut running = FuturesUnordered::new();
    let mut last = failure(FailKind::Other, "no provider");
    let mut next_at = Instant::now();
    loop {
        tokio::select! {
            biased;
            Some((index, result)) = running.next() => match result {
                Ok(answer) => return Ok((index, answer)),
                Err(fail) => {
                    last = fail;
                    next_at = Instant::now();
                }
            },
            _ = tokio::time::sleep_until(next_at), if pending.len() > 0 => {
                if let Some(index) = pending.next() {
                    running.push(attempt(index).map(move |result| (index, result)));
                }
                next_at = Instant::now() + step;
            }
            else => return Err(last),
        }
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::Ordering;
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use tokio::time::Instant;

    use super::{
        CONNECT_TIMEOUT, DohAnswer, HEDGE_AFTER, PROVIDERS, REQUEST_TIMEOUT, TOTAL_BUDGET,
        answer_of, client, configured, hedged, race, sane,
    };
    use crate::network::dns::wire;
    use crate::network::fail::{Fail, FailKind};
    use crate::network::h2_server::h2_tls_server;

    const STEP: Duration = Duration::from_millis(700);
    const SLOW_RTT: Duration = Duration::from_secs(2);
    const COLD_ROUND_TRIPS: u32 = 3;

    fn plan(
        delays: &'static [(u64, bool)],
    ) -> impl Fn(usize) -> futures_util::future::BoxFuture<'static, Result<usize, Fail>> {
        move |index| {
            let (delay, ok) = delays[index];
            Box::pin(async move {
                tokio::time::sleep(Duration::from_millis(delay)).await;
                if ok {
                    Ok(index)
                } else {
                    Err(Fail::of(FailKind::Reset))
                }
            })
        }
    }

    #[tokio::test(start_paused = true)]
    async fn a_fast_provider_answers_alone() {
        let started = Instant::now();
        let won = hedged(
            &[0, 1, 2],
            STEP,
            plan(&[(50, true), (10, true), (10, true)]),
        )
        .await;
        assert_eq!(won.unwrap().0, 0);
        assert_eq!(started.elapsed(), Duration::from_millis(50));
    }

    #[tokio::test(start_paused = true)]
    async fn a_silent_provider_is_hedged_after_700_ms() {
        let started = Instant::now();
        let won = hedged(
            &[0, 1, 2],
            STEP,
            plan(&[(5000, true), (100, true), (10, true)]),
        )
        .await;
        assert_eq!(won.unwrap().0, 1);
        assert_eq!(started.elapsed(), Duration::from_millis(800));
    }

    #[tokio::test(start_paused = true)]
    async fn a_third_provider_starts_after_1400_ms() {
        let started = Instant::now();
        let won = hedged(
            &[0, 1, 2],
            STEP,
            plan(&[(5000, true), (5000, true), (10, true)]),
        )
        .await;
        assert_eq!(won.unwrap().0, 2);
        assert_eq!(started.elapsed(), Duration::from_millis(1410));
    }

    #[tokio::test(start_paused = true)]
    async fn a_failed_provider_hands_over_at_once() {
        let started = Instant::now();
        let won = hedged(
            &[0, 1, 2],
            STEP,
            plan(&[(20, false), (30, true), (10, true)]),
        )
        .await;
        assert_eq!(won.unwrap().0, 1);
        assert_eq!(started.elapsed(), Duration::from_millis(50));
    }

    #[tokio::test(start_paused = true)]
    async fn when_every_provider_fails_the_last_failure_is_returned() {
        let tried = Arc::new(Mutex::new(Vec::new()));
        let seen = tried.clone();
        let failing = plan(&[(10, false), (10, false), (10, false)]);
        let won = hedged(&[2, 0, 1], STEP, move |index| {
            seen.lock().unwrap().push(index);
            failing(index)
        })
        .await;
        assert_eq!(won.unwrap_err().kind, FailKind::Reset);
        assert_eq!(*tried.lock().unwrap(), [2, 0, 1]);
    }

    #[test]
    fn a_cold_query_fits_a_slow_link() {
        let per_address = CONNECT_TIMEOUT / PROVIDERS[0].ips.len() as u32;
        assert!(per_address >= SLOW_RTT);
        assert!(CONNECT_TIMEOUT >= SLOW_RTT * 2);
        assert!(REQUEST_TIMEOUT >= SLOW_RTT * COLD_ROUND_TRIPS);
        let last_hedge = HEDGE_AFTER * 2;
        assert!(TOTAL_BUDGET >= last_hedge + SLOW_RTT * COLD_ROUND_TRIPS);
    }

    #[tokio::test(start_paused = true)]
    async fn a_slow_provider_answers_before_the_budget_runs_out() {
        let started = Instant::now();
        let cold = SLOW_RTT * COLD_ROUND_TRIPS + Duration::from_millis(200);
        let won = race(0, |index| async move {
            tokio::time::sleep(cold).await;
            Ok::<usize, Fail>(index)
        })
        .await;
        assert_eq!(won.unwrap().0, 0);
        assert_eq!(started.elapsed(), cold);
    }

    #[tokio::test(start_paused = true)]
    async fn the_last_hedged_provider_still_gets_a_slow_answer_in() {
        let started = Instant::now();
        let cold = SLOW_RTT * COLD_ROUND_TRIPS + Duration::from_millis(200);
        let won = race(4, |index| async move {
            if index == 1 {
                tokio::time::sleep(cold).await;
                Ok(index)
            } else {
                std::future::pending::<Result<usize, Fail>>().await
            }
        })
        .await;
        assert_eq!(won.unwrap().0, 1);
        assert_eq!(started.elapsed(), HEDGE_AFTER * 2 + cold);
    }

    #[tokio::test(start_paused = true)]
    async fn silence_everywhere_ends_at_the_total_budget() {
        let started = Instant::now();
        let won = race(0, |_| std::future::pending::<Result<usize, Fail>>()).await;
        assert_eq!(won.unwrap_err().kind, FailKind::Timeout);
        assert_eq!(started.elapsed(), TOTAL_BUDGET);
    }

    fn response(rcode: u8, addr: Option<[u8; 4]>) -> Vec<u8> {
        let mut wire = wire::build_query("api.scnative.space").unwrap();
        wire[2] = 0x81;
        wire[3] = 0x80 | rcode;
        if let Some(addr) = addr {
            wire[7] = 1;
            wire.extend_from_slice(&[0xC0, 0x0C, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4]);
            wire.extend_from_slice(&addr);
        }
        wire
    }

    #[test]
    fn an_answer_with_addresses_is_valid() {
        let answer =
            answer_of(&PROVIDERS[1], 200, &response(0, Some([188, 165, 221, 195]))).unwrap();
        assert_eq!(
            answer.addrs,
            ["188.165.221.195".parse::<std::net::IpAddr>().unwrap()]
        );
        assert_eq!((answer.ttl, answer.provider), (60, "google"));
    }

    #[test]
    fn nxdomain_is_a_valid_empty_answer() {
        let answer = answer_of(&PROVIDERS[0], 200, &response(3, None)).unwrap();
        assert!(answer.addrs.is_empty());
    }

    #[test]
    fn servfail_a_bad_status_and_junk_are_failures() {
        let servfail = answer_of(&PROVIDERS[0], 200, &response(2, None)).unwrap_err();
        assert_eq!(servfail.kind, FailKind::Dns);
        let status = answer_of(&PROVIDERS[0], 403, &response(0, None)).unwrap_err();
        assert_eq!(status.kind, FailKind::Status);
        let junk = answer_of(&PROVIDERS[0], 200, b"<html>").unwrap_err();
        assert_eq!(junk.kind, FailKind::Other);
    }

    fn answer(addrs: &[&str]) -> DohAnswer {
        DohAnswer {
            addrs: addrs.iter().map(|ip| ip.parse().unwrap()).collect(),
            ttl: 60,
            provider: "yandex",
        }
    }

    #[test]
    fn garbage_for_our_name_is_a_failure_and_a_foreign_name_keeps_private_addresses() {
        let ours = "API.scnative.space";
        let fail = sane(ours, answer(&["2.26.93.81", "10.0.0.1"])).unwrap_err();
        assert_eq!(fail.kind, FailKind::DnsBogus);
        assert_eq!(
            fail.detail.as_deref(),
            Some("yandex answered 2.26.93.81,10.0.0.1")
        );
        assert_eq!(
            sane(ours, answer(&["127.0.0.1", "188.165.221.195"])).unwrap(),
            answer(&["188.165.221.195"])
        );
        assert_eq!(sane(ours, answer(&[])).unwrap(), answer(&[]));
        assert_eq!(
            sane("example.com", answer(&["10.0.0.1"])).unwrap(),
            answer(&["10.0.0.1"])
        );
        let zero = sane("example.com", answer(&["0.0.0.0"])).unwrap_err();
        assert_eq!(zero.kind, FailKind::DnsBogus);
    }

    #[tokio::test(start_paused = true)]
    async fn a_provider_with_garbage_for_our_name_hands_over_to_the_next() {
        let started = Instant::now();
        let won = hedged(&[0, 1, 2], STEP, |index| async move {
            let (delay, addrs): (u64, &[&str]) = match index {
                0 => (10, &["2.26.93.81"]),
                1 => (30, &["188.165.221.195"]),
                _ => (10, &["1.2.3.4"]),
            };
            tokio::time::sleep(Duration::from_millis(delay)).await;
            sane("api.scnative.space", answer(addrs))
        })
        .await
        .unwrap();
        assert_eq!(won, (1, answer(&["188.165.221.195"])));
        assert_eq!(started.elapsed(), Duration::from_millis(40));
    }

    #[test]
    fn every_provider_is_pinned_to_its_own_addresses() {
        assert!(client().is_some());
        let names: std::collections::HashSet<&str> = PROVIDERS.iter().map(|p| p.name).collect();
        assert_eq!(names.len(), PROVIDERS.len());
        assert!(
            PROVIDERS
                .iter()
                .all(|p| p.ips.iter().all(|ip| !wire::bogus(*ip)))
        );
    }

    #[tokio::test]
    async fn queries_sent_together_share_one_connection() {
        let (url, accepted) = h2_tls_server().await;
        let builder = wreq::Client::builder()
            .no_proxy()
            .tls_cert_verification(false);
        let client = configured(builder).build().unwrap();
        let sent = futures_util::future::join_all((0..4).map(|_| client.get(&url).send())).await;
        for response in sent {
            assert_eq!(response.unwrap().status(), 200);
        }
        assert_eq!(accepted.load(Ordering::SeqCst), 1);
    }
}
