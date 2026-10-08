use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::OnceLock;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use futures_util::FutureExt;
use futures_util::stream::{FuturesUnordered, StreamExt};
use tokio::time::Instant;

use super::wire;
use crate::network::fail::{Fail, FailKind};

const CONNECT_TIMEOUT: Duration = Duration::from_millis(1500);
const REQUEST_TIMEOUT: Duration = Duration::from_millis(2500);
const HEDGE_AFTER: Duration = Duration::from_millis(700);
const HEDGE_WIDTH: usize = 3;
const TOTAL_BUDGET: Duration = Duration::from_secs(3);
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
        let addrs: Vec<SocketAddr> = provider
            .ips
            .iter()
            .map(|ip| SocketAddr::new(*ip, 443))
            .collect();
        builder = builder.resolve_to_addrs(provider.name, &addrs);
    }
    builder
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(REQUEST_TIMEOUT)
        .build()
        .ok()
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
    let order: Vec<usize> = (0..HEDGE_WIDTH)
        .map(|step| (first + step) % PROVIDERS.len())
        .collect();
    let race = hedged(&order, HEDGE_AFTER, |index| {
        query_with(&PROVIDERS[index], host)
    });
    let (index, answer) = tokio::time::timeout(TOTAL_BUDGET, race)
        .await
        .unwrap_or_else(|_| Err(Fail::timeout_after(TOTAL_BUDGET.as_millis() as u32)))?;
    PREFERRED.store(index, Ordering::Relaxed);
    Ok(answer)
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
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use tokio::time::Instant;

    use super::{PROVIDERS, answer_of, client, hedged};
    use crate::network::dns::wire;
    use crate::network::fail::{Fail, FailKind};

    const STEP: Duration = Duration::from_millis(700);

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
}
