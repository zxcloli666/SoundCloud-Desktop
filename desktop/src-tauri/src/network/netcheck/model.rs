use std::collections::BTreeMap;
use std::net::IpAddr;

use serde::{Deserialize, Serialize};

use crate::network::edge::Tier;
use crate::network::fail::{Fail, FailKind};

pub const REPORT_VERSION: u8 = 1;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetReport {
    pub version: u8,
    pub at_ms: u64,
    pub trigger: Trigger,
    pub reason: Option<String>,
    pub duration_ms: u32,
    pub app: AppInfo,
    pub verdict: Verdict,
    pub hint: Hint,
    pub remote: Remote,
    pub internet: Internet,
    pub targets: Vec<TargetCheck>,
    pub doh: Vec<DohProbe>,
    pub env: Option<EnvInfo>,
    pub edge: EdgeSnapshot,
    pub recent: Vec<PathEvent>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Trigger {
    Manual,
    Auto,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
    pub install: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Verdict {
    Checking,
    Ok,
    BackupDown,
    Partial,
    RelayOnly,
    Dns,
    DnsFailed,
    Reset,
    Timeout,
    Cert,
    Down,
    Offline,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Hint {
    None,
    Zapret,
    ZapretTimestamps,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Remote {
    Up,
    Down,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Internet {
    Online,
    Offline,
    Unknown,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TargetId {
    Main,
    Star,
    Storage,
    Images,
    Relay,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Tone {
    Ok,
    Warn,
    Fail,
    Skip,
    Pending,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DnsState {
    Sane,
    Garbage,
    Spoofed,
    Failed,
    Unchecked,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetCheck {
    pub id: TargetId,
    pub node: Option<String>,
    pub host: String,
    pub proxied: bool,
    pub system: DnsAnswer,
    pub doh: Option<DnsAnswer>,
    pub dns: DnsState,
    pub probe: Option<PhaseProbe>,
    pub doh_probe: Option<PhaseProbe>,
    pub app: Option<AppProbe>,
    pub ok: bool,
    pub cells: [Tone; 4],
    pub total_ms: Option<u32>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DnsAnswer {
    pub addrs: Vec<IpAddr>,
    pub ms: Option<u32>,
    pub fail: Option<Fail>,
    pub provider: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PhaseProbe {
    pub addr: Option<IpAddr>,
    pub dns_ms: Option<u32>,
    pub tcp_ms: Option<u32>,
    pub tls_ms: Option<u32>,
    pub first_byte_ms: Option<u32>,
    pub status: Option<u16>,
    pub fail: Option<Fail>,
    pub cert_issuer: Option<String>,
    pub tcp_timestamps: Option<bool>,
    pub syn_retrans: Option<u8>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppProbe {
    pub ok: bool,
    pub status: Option<u16>,
    pub ms: Option<u32>,
    pub fail: Option<Fail>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DohProbe {
    pub provider: String,
    pub ok: bool,
    pub ms: Option<u32>,
    pub fail: Option<Fail>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvInfo {
    pub dpi: Vec<DpiTool>,
    pub services: Vec<ServiceInfo>,
    pub tcp_timestamps: Option<String>,
    pub zapret_config: Option<ZapretConfig>,
    pub units: Vec<String>,
    pub sandbox: Option<String>,
    pub proxy: bool,
    pub env_proxy: Vec<String>,
    pub vpn: Vec<String>,
    pub dns_servers: Vec<IpAddr>,
    pub notes: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DpiTool {
    pub name: String,
    pub args: Option<String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceInfo {
    pub name: String,
    pub image: Option<String>,
    pub strategy: Option<String>,
    pub start: Option<u32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZapretConfig {
    pub path: String,
    pub values: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EdgeSnapshot {
    pub pins: Vec<(String, u64)>,
    pub pool: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PathEvent {
    pub at_ms: u64,
    pub origin: String,
    pub tier: Tier,
    pub role: Role,
    pub ok: bool,
    pub status: Option<u16>,
    pub fail: Option<FailKind>,
    pub ms: Option<u32>,
    pub source: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Role {
    Primary,
    Failover,
    Hedge,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetCheckUpdate {
    pub running: bool,
    pub report: NetReport,
}

impl Role {
    pub fn of_index(index: usize) -> Self {
        if index == 0 {
            Self::Primary
        } else {
            Self::Failover
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Primary => "primary",
            Self::Failover => "failover",
            Self::Hedge => "hedge",
        }
    }
}

impl TargetId {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Main => "main",
            Self::Star => "star",
            Self::Storage => "storage",
            Self::Images => "images",
            Self::Relay => "relay",
        }
    }
}

impl Verdict {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Checking => "checking",
            Self::Ok => "ok",
            Self::BackupDown => "backup-down",
            Self::Partial => "partial",
            Self::RelayOnly => "relay-only",
            Self::Dns => "dns",
            Self::DnsFailed => "dns-failed",
            Self::Reset => "reset",
            Self::Timeout => "timeout",
            Self::Cert => "cert",
            Self::Down => "down",
            Self::Offline => "offline",
            Self::Unknown => "unknown",
        }
    }
}

impl Hint {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::None => "none",
            Self::Zapret => "zapret",
            Self::ZapretTimestamps => "zapret-timestamps",
        }
    }
}

impl Remote {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Up => "up",
            Self::Down => "down",
            Self::Unknown => "unknown",
        }
    }
}

impl Internet {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Online => "online",
            Self::Offline => "offline",
            Self::Unknown => "unknown",
        }
    }
}

impl Trigger {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Auto => "auto",
        }
    }
}

impl TargetCheck {
    pub fn pending(id: TargetId, node: Option<String>, host: String) -> Self {
        Self {
            id,
            node,
            host,
            proxied: false,
            system: DnsAnswer::default(),
            doh: None,
            dns: DnsState::Unchecked,
            probe: None,
            doh_probe: None,
            app: None,
            ok: false,
            cells: [Tone::Pending; 4],
            total_ms: None,
        }
    }
}

impl PhaseProbe {
    pub fn passed(&self) -> bool {
        self.fail.is_none() && self.status.is_some_and(|status| status < 500)
    }
}
