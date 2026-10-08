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
use std::io;
use std::net::IpAddr;
use std::sync::{Arc, OnceLock};
use std::time::Duration;

use futures_util::future::{BoxFuture, FutureExt};
use tokio::runtime::Handle;

use self::doh::DohAnswer;
use self::fallback::Fallback;
pub use self::wire::{garbage, tunnelled};
use crate::network::edge;
use crate::network::fail::{Fail, FailKind};

const SYSTEM_BUDGET: Duration = Duration::from_secs(2);
const OUR_ZONES: [&str; 2] = ["scnative.space", "soundcloud-desktop.fun"];
const LOCAL_SUFFIXES: [&str; 5] = [".localhost", ".local", ".lan", ".internal", ".home.arpa"];
const NOT_FOUND_CODES: [i32; 2] = [11001, 11004];
const NOT_FOUND_TEXTS: [&str; 4] = [
    "not known",
    "no address associated",
    "does not resolve",
    "no such host",
];

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
    if let Some(fallback) = SHARED.get() {
        fallback.suspect(&normalize(host));
    }
}

pub fn epoch() -> u64 {
    SHARED.get().map_or(0, Fallback::epoch)
}

pub async fn changed_since(host: &str, epoch: u64) -> bool {
    match SHARED.get() {
        Some(fallback) => fallback.changed_since(&normalize(host), epoch).await,
        None => false,
    }
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
    match tokio::net::lookup_host((host.as_str(), 0)).await {
        Ok(addrs) => Ok(addrs.map(|addr| addr.ip()).collect()),
        Err(error) if not_found(&error) => Ok(Vec::new()),
        Err(error) => Err(Fail {
            detail: Some(error.to_string()),
            ..Fail::of(FailKind::Dns)
        }),
    }
}

fn not_found(error: &io::Error) -> bool {
    if error
        .raw_os_error()
        .is_some_and(|code| NOT_FOUND_CODES.contains(&code))
    {
        return true;
    }
    reads_as_not_found(&error.to_string(), &resolver_texts())
}

fn reads_as_not_found(text: &str, localized: &[String]) -> bool {
    let lower = text.to_ascii_lowercase();
    NOT_FOUND_TEXTS.iter().any(|needle| lower.contains(needle))
        || localized.iter().any(|line| text.contains(line.as_str()))
}

#[cfg(unix)]
fn resolver_texts() -> Vec<String> {
    [libc::EAI_NONAME, libc::EAI_NODATA]
        .into_iter()
        .map(|code| {
            let text = unsafe { std::ffi::CStr::from_ptr(libc::gai_strerror(code)) };
            text.to_string_lossy().into_owned()
        })
        .filter(|text| !text.is_empty())
        .collect()
}

#[cfg(not(unix))]
fn resolver_texts() -> Vec<String> {
    Vec::new()
}

fn runtime() -> Option<Handle> {
    Handle::try_current()
        .ok()
        .or_else(|| RUNTIME.get().cloned())
}

fn spawn(task: impl Future<Output = ()> + Send + 'static) {
    if let Some(handle) = runtime() {
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
