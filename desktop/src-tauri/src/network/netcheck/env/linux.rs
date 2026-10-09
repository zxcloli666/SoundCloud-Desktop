use std::fs;
use std::net::IpAddr;
use std::path::Path;

use super::{
    cmdline, hidepid, parse_resolv_conf, parse_zapret_config, sysctl_timestamps, tool_for,
};
use crate::network::netcheck::model::{DpiTool, EnvInfo, ZapretConfig};

const CONFIG_PATHS: [&str; 5] = [
    "/opt/zapret/config",
    "/opt/zapret2/config",
    "/etc/zapret/config",
    "/etc/zapret2/config",
    "/usr/local/etc/zapret/config",
];
const UNIT_DIRS: [&str; 3] = [
    "/etc/systemd/system",
    "/lib/systemd/system",
    "/usr/lib/systemd/system",
];
const UNIT_NAMES: [&str; 2] = ["zapret.service", "zapret2.service"];
const WANTS_DIR: &str = "/etc/systemd/system/multi-user.target.wants";
const TIMESTAMPS: &str = "/proc/sys/net/ipv4/tcp_timestamps";
const RESOLV_CONF: &str = "/etc/resolv.conf";
const RESOLVED_UPSTREAM: &str = "/run/systemd/resolve/resolv.conf";
const MAX_CONFIG_BYTES: u64 = 256 * 1024;

pub async fn detect() -> EnvInfo {
    tokio::task::spawn_blocking(scan).await.unwrap_or_default()
}

fn scan() -> EnvInfo {
    let mut info = EnvInfo {
        tcp_timestamps: fs::read_to_string(TIMESTAMPS)
            .ok()
            .and_then(|value| sysctl_timestamps(&value)),
        dns_servers: dns_servers(),
        ..EnvInfo::default()
    };
    if let Some(sandbox) = sandbox() {
        info.sandbox = Some(sandbox.to_string());
        info.notes.push("sandbox".to_string());
        return info;
    }
    info.dpi = running();
    info.zapret_config = zapret_config();
    info.units = units();
    if fs::read_to_string("/proc/mounts").is_ok_and(|mounts| hidepid(&mounts)) {
        info.notes.push("hidepid".to_string());
    }
    info
}

fn sandbox() -> Option<&'static str> {
    if Path::new("/.flatpak-info").exists() || std::env::var_os("FLATPAK_ID").is_some() {
        Some("flatpak")
    } else if std::env::var_os("SNAP").is_some() {
        Some("snap")
    } else {
        None
    }
}

fn running() -> Vec<DpiTool> {
    let Ok(dir) = fs::read_dir("/proc") else {
        return Vec::new();
    };
    dir.flatten()
        .filter(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .bytes()
                .all(|byte| byte.is_ascii_digit())
        })
        .filter_map(|entry| {
            let path = entry.path();
            let comm = fs::read_to_string(path.join("comm")).ok()?;
            let tool = tool_for(&comm)?;
            let args = fs::read(path.join("cmdline"))
                .ok()
                .map(|raw| cmdline(&raw))
                .filter(|line| !line.is_empty());
            Some(DpiTool {
                name: tool.to_string(),
                args,
            })
        })
        .collect()
}

fn zapret_config() -> Option<ZapretConfig> {
    CONFIG_PATHS.iter().find_map(|path| {
        let size = fs::metadata(path).ok()?.len();
        if size > MAX_CONFIG_BYTES {
            return None;
        }
        let text = fs::read_to_string(path).ok()?;
        Some(ZapretConfig {
            path: (*path).to_string(),
            values: parse_zapret_config(&text),
        })
    })
}

fn units() -> Vec<String> {
    let mut found: Vec<String> = UNIT_DIRS
        .iter()
        .flat_map(|dir| UNIT_NAMES.iter().map(move |name| Path::new(dir).join(name)))
        .filter(|path| path.exists())
        .filter_map(|path| {
            path.file_name()
                .map(|name| name.to_string_lossy().into_owned())
        })
        .collect();
    if let Ok(wants) = fs::read_dir(WANTS_DIR) {
        found.extend(
            wants
                .flatten()
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
                .filter(|name| name.starts_with("nfqws") || name.starts_with("zapret")),
        );
    }
    found.sort();
    found.dedup();
    found
}

fn dns_servers() -> Vec<IpAddr> {
    let stub = fs::read_to_string(RESOLV_CONF)
        .map(|text| parse_resolv_conf(&text))
        .unwrap_or_default();
    if stub.iter().any(IpAddr::is_loopback) {
        let upstream = fs::read_to_string(RESOLVED_UPSTREAM)
            .map(|text| parse_resolv_conf(&text))
            .unwrap_or_default();
        if !upstream.is_empty() {
            return upstream;
        }
    }
    stub
}
