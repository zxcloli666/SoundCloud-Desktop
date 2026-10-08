#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;

#[cfg(test)]
mod tests;

#[cfg(any(target_os = "linux", test))]
use std::collections::BTreeMap;
use std::net::IpAddr;

#[cfg(target_os = "linux")]
use self::linux as os;
#[cfg(target_os = "macos")]
use self::macos as os;
#[cfg(windows)]
use self::windows as os;
use super::model::{DpiTool, EnvInfo};
#[cfg(any(target_os = "linux", test))]
use super::scrub::capped;
use crate::network::system_proxy;

const DPI_TOOLS: [&str; 10] = [
    "winws",
    "winws2",
    "goodbyedpi",
    "nfqws",
    "nfqws2",
    "tpws",
    "dvtws",
    "ciadpi",
    "byedpi",
    "spoofdpi",
];
const VPN_PREFIXES: [&str; 8] = [
    "tun",
    "tap",
    "utun",
    "wg",
    "ppp",
    "wintun",
    "zt",
    "tailscale",
];
const VPN_WORDS: [&str; 11] = [
    "vpn",
    "wireguard",
    "clash",
    "sing",
    "meta",
    "nekoray",
    "hiddify",
    "outline",
    "amnezia",
    "proton",
    "warp",
];
#[cfg(any(target_os = "linux", test))]
const ZAPRET_KEYS: [&str; 10] = [
    "MODE_FILTER",
    "FWTYPE",
    "NFQWS_ENABLE",
    "NFQWS2_ENABLE",
    "TPWS_ENABLE",
    "NFQWS_OPT",
    "NFQWS2_OPT",
    "NFQWS_PORTS_TCP",
    "NFQWS2_PORTS_TCP",
    "DISABLE_IPV6",
];
const PROXY_PROBE: &str = "https://api.scnative.space/";
const MAX_DPI: usize = 4;

#[cfg(not(any(target_os = "linux", target_os = "macos", windows)))]
mod os {
    pub async fn detect() -> super::EnvInfo {
        super::EnvInfo::default()
    }
}

pub async fn detect() -> EnvInfo {
    let mut info = os::detect().await;
    info.dpi = distinct(info.dpi);
    info.proxy = system_proxy::proxied(PROXY_PROBE);
    info.env_proxy = system_proxy::env_proxy_names();
    info.vpn = vpn_interfaces();
    info
}

fn vpn_interfaces() -> Vec<String> {
    let mut names: Vec<String> = if_addrs::get_if_addrs()
        .unwrap_or_default()
        .into_iter()
        .filter(|iface| !matches!(iface.oper_status, if_addrs::IfOperStatus::Down))
        .filter(|iface| routable(iface.ip()))
        .map(|iface| iface.name)
        .filter(|name| vpn_like(name))
        .collect();
    names.sort();
    names.dedup();
    names
}

fn routable(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => !v4.is_loopback() && !v4.is_link_local(),
        IpAddr::V6(v6) => !v6.is_loopback() && (v6.segments()[0] & 0xFFC0) != 0xFE80,
    }
}

pub fn distinct(tools: Vec<DpiTool>) -> Vec<DpiTool> {
    let mut kept: Vec<DpiTool> = Vec::new();
    for tool in tools {
        if kept.len() < MAX_DPI && !kept.contains(&tool) {
            kept.push(tool);
        }
    }
    kept
}

pub fn tool_for(process_name: &str) -> Option<&'static str> {
    let lower = process_name.trim().to_ascii_lowercase();
    let stem = lower.strip_suffix(".exe").unwrap_or(&lower);
    DPI_TOOLS.iter().copied().find(|tool| *tool == stem)
}

pub fn vpn_like(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    VPN_PREFIXES.iter().any(|prefix| lower.starts_with(prefix))
        || VPN_WORDS.iter().any(|word| lower.contains(word))
}

pub fn uses_ts_fooling(args: &str) -> bool {
    args.split_whitespace().any(|token| {
        let fooling = token
            .strip_prefix("--dpi-desync-fooling=")
            .is_some_and(|list| list.split(',').any(|item| item == "ts"));
        fooling || token.contains("tcp_ts")
    })
}

#[cfg(any(target_os = "linux", test))]
pub fn cmdline(raw: &[u8]) -> String {
    let joined = raw
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(String::from_utf8_lossy)
        .collect::<Vec<_>>()
        .join(" ");
    capped(&joined)
}

#[cfg(any(target_os = "linux", test))]
pub fn parse_zapret_config(text: &str) -> BTreeMap<String, String> {
    let mut found = BTreeMap::new();
    let mut lines = text.lines();
    while let Some(line) = lines.next() {
        let line = line.trim();
        if line.starts_with('#') {
            continue;
        }
        let Some((key, rest)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        if !ZAPRET_KEYS.contains(&key) {
            continue;
        }
        let rest = rest.trim();
        let value = match rest.strip_prefix('"') {
            Some(open) => {
                let mut body = open.to_string();
                while !body.contains('"') {
                    let Some(next) = lines.next() else { break };
                    body.push('\n');
                    body.push_str(next);
                }
                body.split('"').next().unwrap_or_default().to_string()
            }
            None => rest
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .to_string(),
        };
        let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
        found.insert(key.to_string(), capped(&value));
    }
    found
}

#[cfg(any(windows, test))]
pub fn netsh_timestamps(output: &[u8]) -> Option<String> {
    let text = String::from_utf8_lossy(output);
    let line = text
        .lines()
        .find(|line| line.contains("1323") && line.contains(':'))?;
    let value = line.rsplit(':').next()?.trim().to_ascii_lowercase();
    match value.as_str() {
        "" => None,
        "enabled" | "disabled" => Some(value),
        other => Some(other.chars().take(32).collect()),
    }
}

#[cfg(any(not(windows), test))]
pub fn parse_resolv_conf(text: &str) -> Vec<IpAddr> {
    text.lines()
        .filter_map(|line| line.trim().strip_prefix("nameserver"))
        .filter_map(|rest| rest.split_whitespace().next())
        .filter_map(|addr| addr.split('%').next()?.parse().ok())
        .collect()
}

#[cfg(any(target_os = "linux", test))]
pub fn hidepid(mounts: &str) -> bool {
    mounts.lines().any(|line| {
        let mut fields = line.split_whitespace();
        let _source = fields.next();
        fields.next() == Some("/proc")
            && fields.next() == Some("proc")
            && fields
                .next()
                .is_some_and(|options| options.contains("hidepid"))
    })
}

#[cfg(any(target_os = "linux", test))]
pub fn sysctl_timestamps(value: &str) -> Option<String> {
    match value.trim() {
        "" => None,
        "0" => Some("disabled".to_string()),
        "1" | "2" => Some("enabled".to_string()),
        other => Some(other.chars().take(32).collect()),
    }
}
