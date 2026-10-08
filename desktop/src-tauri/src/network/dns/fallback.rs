use std::collections::HashMap;
use std::error::Error;
use std::net::{IpAddr, SocketAddr};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use futures_util::future::{BoxFuture, FutureExt, Shared};
use tokio::time::Instant;
use wreq::dns::{Addrs, Name, Resolve, Resolving};

use super::cache::Cache;
use super::{Config, DnsError, Scope, normalize, scope, wire};
use crate::app::diagnostics;
use crate::network::fail::{Fail, FailKind};

const GARBAGE_DISTRUST: Duration = Duration::from_secs(600);
const MAX_DOH_ADDRS: usize = 2;
const SEEN_CAPACITY: usize = 64;

pub(super) type Found = Result<Vec<IpAddr>, Fail>;
type Flight = Shared<BoxFuture<'static, Result<Vec<IpAddr>, DnsError>>>;

enum Judgement {
    Sane(Vec<IpAddr>),
    Garbage { definitive: bool },
    Truth,
}

#[derive(Default)]
pub(super) struct Memory {
    pub(super) cache: Cache,
    pub(super) seen: HashMap<String, (Vec<IpAddr>, Instant)>,
    pub(super) suspected: HashMap<String, Instant>,
    pub(super) distrusted_until: Option<Instant>,
    pub(super) warmed_at: Option<Instant>,
    flights: HashMap<String, Flight>,
}

pub(super) struct Inner {
    pub(super) config: Config,
    memory: Mutex<Memory>,
}

#[derive(Clone)]
pub struct Fallback(pub(super) Arc<Inner>);

impl Fallback {
    pub fn new(config: Config) -> Self {
        Self(Arc::new(Inner {
            config,
            memory: Mutex::new(Memory::default()),
        }))
    }

    pub(super) fn memory(&self) -> MutexGuard<'_, Memory> {
        self.0
            .memory
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
    }

    pub(super) fn known(&self, host: &str) -> bool {
        scope(host) == Scope::Ours && (self.0.config.known)(host)
    }

    pub async fn lookup(&self, host: &str) -> Result<Vec<IpAddr>, DnsError> {
        let host = normalize(host);
        if scope(&host) == Scope::Local {
            return (self.0.config.system)(host.clone())
                .await
                .map_err(|fail| dns_error(&host, FailKind::Dns, fail.to_string()));
        }
        if let Some(hit) = self.memory().cache.fresh(&host, Instant::now()) {
            return Ok(hit);
        }
        self.flight(host).await
    }

    fn flight(&self, host: String) -> Flight {
        let mut memory = self.memory();
        if let Some(flight) = memory.flights.get(&host) {
            return flight.clone();
        }
        let this = self.clone();
        let key = host.clone();
        let flight = async move {
            let found = this.find(&key).await;
            this.memory().flights.remove(&key);
            found
        }
        .boxed()
        .shared();
        memory.flights.insert(host, flight.clone());
        flight
    }

    async fn find(&self, host: &str) -> Result<Vec<IpAddr>, DnsError> {
        let scope = scope(host);
        let known = self.known(host);
        if known && !self.tunnels(host) && self.distrusted(Instant::now()) {
            return self.doh_first(host, scope).await;
        }
        let system = self.system(host, scope).await;
        match judge(scope, known, &system) {
            Judgement::Sane(addrs) => Ok(addrs),
            Judgement::Truth => Err(dns_error(host, FailKind::Dns, described(&system))),
            Judgement::Garbage { definitive } => match self.ask_doh(host).await {
                Ok(addrs) => {
                    if known && definitive {
                        self.distrust_garbage(host, &system);
                    }
                    Ok(addrs)
                }
                Err(doh) => self.rescue(host, &system, doh),
            },
        }
    }

    async fn doh_first(&self, host: &str, scope: Scope) -> Result<Vec<IpAddr>, DnsError> {
        let doh = match self.ask_doh(host).await {
            Ok(addrs) => return Ok(addrs),
            Err(fail) => fail,
        };
        let system = self.system(host, scope).await;
        match judge(scope, false, &system) {
            Judgement::Sane(addrs) => Ok(addrs),
            Judgement::Garbage { .. } | Judgement::Truth => self.rescue(host, &system, doh),
        }
    }

    pub(super) fn tunnels(&self, host: &str) -> bool {
        self.memory()
            .seen
            .get(host)
            .is_some_and(|(addrs, _)| addrs.iter().any(|ip| wire::tunnelled(*ip)))
    }

    fn distrust_garbage(&self, host: &str, system: &Found) {
        if self.distrust(GARBAGE_DISTRUST) {
            diagnostics::log(
                "WARN",
                format!(
                    "[DNS] {host}: system answer {} is unusable, using DoH for 10 min",
                    described(system)
                ),
            );
        }
        self.warm();
    }

    async fn system(&self, host: &str, scope: Scope) -> Found {
        let lookup = (self.0.config.system)(host.to_string());
        let found = if scope == Scope::Ours {
            let budget = self.0.config.system_budget;
            tokio::time::timeout(budget, lookup)
                .await
                .unwrap_or_else(|_| Err(Fail::timeout_after(budget.as_millis() as u32)))
        } else {
            lookup.await
        };
        self.remember(host, &found);
        found
    }

    fn remember(&self, host: &str, found: &Found) {
        let now = Instant::now();
        let addrs = found.as_ref().cloned().unwrap_or_default();
        let mut memory = self.memory();
        if !memory.seen.contains_key(host) && memory.seen.len() >= SEEN_CAPACITY {
            let oldest = memory
                .seen
                .iter()
                .min_by_key(|(_, (_, at))| *at)
                .map(|(host, _)| host.clone());
            if let Some(oldest) = oldest {
                memory.seen.remove(&oldest);
            }
        }
        memory.seen.insert(host.to_string(), (addrs, now));
    }

    pub(super) async fn ask_doh(&self, host: &str) -> Found {
        if self.memory().cache.failed_recently(host, Instant::now()) {
            return Err(Fail {
                detail: Some("doh failed moments ago".to_string()),
                ..Fail::of(FailKind::Dns)
            });
        }
        let answer = (self.0.config.doh)(host.to_string()).await;
        let now = Instant::now();
        let mut memory = self.memory();
        match answer {
            Ok(answer) => {
                let addrs = capped(trusted(answer.addrs));
                if addrs.is_empty() {
                    memory.cache.fail(host, now);
                    return Err(Fail {
                        detail: Some(format!("no such name at {}", answer.provider)),
                        ..Fail::of(FailKind::Dns)
                    });
                }
                memory.cache.put(host, addrs.clone(), answer.ttl, now);
                Ok(addrs)
            }
            Err(fail) => {
                memory.cache.fail(host, now);
                Err(fail)
            }
        }
    }

    fn rescue(&self, host: &str, system: &Found, doh: Fail) -> Result<Vec<IpAddr>, DnsError> {
        if let Some(stale) = self.memory().cache.stale(host, Instant::now()) {
            return Ok(stale);
        }
        let kind = match system {
            Ok(addrs) if !addrs.is_empty() => FailKind::DnsBogus,
            _ => FailKind::Dns,
        };
        let reason = format!("system {}; doh {doh}", described(system));
        Err(dns_error(host, kind, reason))
    }
}

fn judge(scope: Scope, known: bool, system: &Found) -> Judgement {
    match system {
        Ok(addrs) if !addrs.is_empty() => {
            let usable = usable(scope, addrs);
            if usable.is_empty() {
                Judgement::Garbage { definitive: true }
            } else {
                Judgement::Sane(usable)
            }
        }
        Ok(_) if known => Judgement::Garbage { definitive: true },
        Err(fail) if known || (fail.kind == FailKind::Timeout && scope == Scope::Ours) => {
            Judgement::Garbage { definitive: false }
        }
        _ => Judgement::Truth,
    }
}

fn usable(scope: Scope, addrs: &[IpAddr]) -> Vec<IpAddr> {
    let garbage = |ip: IpAddr| match scope {
        Scope::Ours => wire::garbage(ip),
        Scope::Local | Scope::Foreign => ip.is_unspecified() || wire::SINKHOLES.contains(&ip),
    };
    addrs.iter().copied().filter(|ip| !garbage(*ip)).collect()
}

pub(super) fn trusted(addrs: Vec<IpAddr>) -> Vec<IpAddr> {
    addrs
        .into_iter()
        .filter(|ip| !ip.is_unspecified())
        .collect()
}

pub(super) fn capped(mut addrs: Vec<IpAddr>) -> Vec<IpAddr> {
    addrs.truncate(MAX_DOH_ADDRS);
    addrs
}

pub(super) fn listed(addrs: &[IpAddr]) -> String {
    if addrs.is_empty() {
        return "no address".to_string();
    }
    addrs
        .iter()
        .map(IpAddr::to_string)
        .collect::<Vec<_>>()
        .join(",")
}

fn described(system: &Found) -> String {
    match system {
        Ok(addrs) => listed(addrs),
        Err(fail) => fail.to_string(),
    }
}

fn dns_error(host: &str, kind: FailKind, reason: String) -> DnsError {
    DnsError {
        kind,
        host: host.to_string(),
        reason,
    }
}

impl Resolve for Fallback {
    fn resolve(&self, name: Name) -> Resolving {
        let this = self.clone();
        let host = name.as_str().to_string();
        Box::pin(async move {
            let found = this
                .lookup(&host)
                .await
                .map_err(|error| -> Box<dyn Error + Send + Sync> { Box::new(error) })?;
            let addrs: Addrs = Box::new(found.into_iter().map(|ip| SocketAddr::new(ip, 0)));
            Ok(addrs)
        })
    }
}
