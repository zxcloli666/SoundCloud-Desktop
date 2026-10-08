mod cache;
mod distrust;
pub mod doh;
mod fallback;
mod wire;

#[cfg(test)]
mod tests;

use std::error::Error;
use std::fmt;
use std::future::Future;
use std::net::IpAddr;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use futures_util::future::{BoxFuture, FutureExt};
use tokio::runtime::Handle;

use self::doh::DohAnswer;
use self::fallback::Fallback;
use crate::network::edge;
use crate::network::fail::{Fail, FailKind};

const SYSTEM_BUDGET: Duration = Duration::from_secs(2);
const OUR_ZONES: [&str; 2] = ["scnative.space", "soundcloud-desktop.fun"];
const LOCAL_SUFFIXES: [&str; 5] = [".localhost", ".local", ".lan", ".internal", ".home.arpa"];

pub type Lookup<T> = Arc<dyn Fn(String) -> BoxFuture<'static, Result<T, Fail>> + Send + Sync>;

pub struct Config {
    pub system: Lookup<Vec<IpAddr>>,
    pub doh: Lookup<DohAnswer>,
    pub system_budget: Duration,
    pub known: fn(&str) -> bool,
    pub zone: fn() -> Vec<String>,
}

#[derive(Clone, Debug)]
pub struct DnsError {
    pub kind: FailKind,
    pub host: String,
    pub reason: String,
}

impl fmt::Display for DnsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "dns error for {}: {}", self.host, self.reason)
    }
}

impl Error for DnsError {}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Scope {
    Local,
    Ours,
    Foreign,
}

static SHARED: OnceLock<Fallback> = OnceLock::new();
static RUNTIME: OnceLock<Handle> = OnceLock::new();

pub fn init(runtime: Handle) {
    let _ = RUNTIME.set(runtime);
}

pub fn install(builder: wreq::ClientBuilder) -> wreq::ClientBuilder {
    builder.dns_resolver(Arc::new(shared().clone()))
}

pub fn client() -> wreq::Client {
    static CLIENT: OnceLock<wreq::Client> = OnceLock::new();
    CLIENT
        .get_or_init(|| install(wreq::Client::builder()).build().unwrap_or_default())
        .clone()
}

pub async fn lookup(host: &str) -> Result<Vec<IpAddr>, DnsError> {
    shared().lookup(host).await
}

pub fn suspect(host: &str) {
    let Some(fallback) = SHARED.get() else { return };
    let host = normalize(host);
    let Some(system) = fallback.suspicion_due(&host) else {
        return;
    };
    let fallback = fallback.clone();
    spawn(async move {
        fallback.confirm(&host, system).await;
    });
}

fn shared() -> &'static Fallback {
    SHARED.get_or_init(|| {
        Fallback::new(Config {
            system: Arc::new(|host| system_lookup(host).boxed()),
            doh: Arc::new(|host| async move { doh::query(&host).await }.boxed()),
            system_budget: SYSTEM_BUDGET,
            known: edge::is_known_host,
            zone: edge::zone_hosts,
        })
    })
}

async fn system_lookup(host: String) -> Result<Vec<IpAddr>, Fail> {
    tokio::net::lookup_host((host.as_str(), 0))
        .await
        .map(|addrs| addrs.map(|addr| addr.ip()).collect())
        .map_err(|error| Fail {
            detail: Some(error.to_string()),
            ..Fail::of(FailKind::Dns)
        })
}

fn spawn(task: impl Future<Output = ()> + Send + 'static) {
    if let Ok(handle) = Handle::try_current() {
        handle.spawn(task);
    } else if let Some(handle) = RUNTIME.get() {
        handle.spawn(task);
    }
}

fn normalize(host: &str) -> String {
    host.trim_end_matches('.').to_ascii_lowercase()
}

fn scope(host: &str) -> Scope {
    let literal = host.trim_start_matches('[').trim_end_matches(']');
    if literal.parse::<IpAddr>().is_ok()
        || !host.contains('.')
        || host == "localhost"
        || LOCAL_SUFFIXES.iter().any(|suffix| host.ends_with(suffix))
    {
        return Scope::Local;
    }
    let ours = OUR_ZONES.iter().any(|zone| {
        host == *zone
            || host
                .strip_suffix(zone)
                .is_some_and(|rest| rest.ends_with('.'))
    });
    if ours { Scope::Ours } else { Scope::Foreign }
}
