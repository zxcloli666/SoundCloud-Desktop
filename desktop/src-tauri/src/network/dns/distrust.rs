use std::net::IpAddr;
use std::time::Duration;

use futures_util::FutureExt;
use futures_util::stream::{self, StreamExt};
use tokio::time::Instant;

use super::fallback::{Fallback, capped, listed, usable};
use super::{Scope, spawn, wire};
use crate::app::diagnostics;

const MISMATCH_DISTRUST: Duration = Duration::from_secs(1800);
const SUSPECT_EVERY: Duration = Duration::from_secs(300);
const WARM_EVERY: Duration = Duration::from_secs(600);
const WARM_PARALLEL: usize = 3;

impl Fallback {
    pub(super) fn distrusted(&self, now: Instant) -> bool {
        self.memory()
            .distrusted_until
            .is_some_and(|until| now < until)
    }

    pub(super) fn distrust(&self, span: Duration) -> bool {
        let now = Instant::now();
        let until = now + span;
        let mut memory = self.memory();
        let started = memory.distrusted_until.is_none_or(|at| at <= now);
        memory.distrusted_until = Some(memory.distrusted_until.map_or(until, |at| at.max(until)));
        if started {
            memory.epoch += 1;
        }
        started
    }

    pub(super) fn epoch(&self) -> u64 {
        self.memory().epoch
    }

    pub(super) fn suspect(&self, host: &str) {
        let Some(system) = self.suspicion_due(host) else {
            return;
        };
        let this = self.clone();
        let key = host.to_string();
        let check = async move {
            let moved = this.confirm(&key, system).await;
            this.memory().checks.remove(&key);
            moved
        }
        .boxed()
        .shared();
        self.memory().checks.insert(host.to_string(), check.clone());
        spawn(check.map(drop));
    }

    pub(super) async fn changed_since(&self, host: &str, epoch: u64) -> bool {
        let check = self.memory().checks.get(host).cloned();
        if let Some(check) = check {
            check.await;
        }
        self.epoch() != epoch
    }

    pub(super) fn warm(&self) {
        let now = Instant::now();
        {
            let mut memory = self.memory();
            if memory
                .warmed_at
                .is_some_and(|at| now.duration_since(at) < WARM_EVERY)
            {
                return;
            }
            memory.warmed_at = Some(now);
        }
        let this = self.clone();
        spawn(async move {
            let hosts = (this.0.config.zone)();
            stream::iter(hosts)
                .for_each_concurrent(WARM_PARALLEL, |host| {
                    let this = this.clone();
                    async move {
                        let cached = this.memory().cache.fresh(&host, Instant::now()).is_some();
                        if !cached && !this.tunnels(&host) {
                            let _ = this.ask_doh(&host).await;
                        }
                    }
                })
                .await;
        });
    }

    pub(super) fn suspicion_due(&self, host: &str) -> Option<Vec<IpAddr>> {
        let now = Instant::now();
        if !self.known(host) || self.distrusted(now) {
            return None;
        }
        let mut memory = self.memory();
        let system = memory
            .seen
            .get(host)
            .map(|(addrs, _)| addrs.clone())
            .filter(|addrs| !addrs.is_empty())?;
        if system.iter().any(|ip| wire::tunnelled(*ip)) {
            return None;
        }
        let recent = memory
            .suspected
            .get(host)
            .is_some_and(|at| now.duration_since(*at) < SUSPECT_EVERY);
        if recent {
            return None;
        }
        memory.suspected.insert(host.to_string(), now);
        Some(system)
    }

    pub(super) async fn confirm(&self, host: &str, system: Vec<IpAddr>) -> bool {
        let Ok(answer) = (self.0.config.doh)(host.to_string()).await else {
            return false;
        };
        let doh = usable(Scope::Ours, &answer.addrs);
        if doh.is_empty() || doh.iter().any(|ip| system.contains(ip)) {
            return false;
        }
        self.memory()
            .cache
            .put(host, capped(doh.clone()), answer.ttl, Instant::now());
        self.distrust(MISMATCH_DISTRUST);
        self.warm();
        diagnostics::log(
            "WARN",
            format!(
                "[DNS] {host}: system {} differs from DoH {}, using DoH for 30 min",
                listed(&system),
                listed(&doh)
            ),
        );
        true
    }
}
