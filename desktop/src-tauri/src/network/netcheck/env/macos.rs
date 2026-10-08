use std::net::IpAddr;

use super::{parse_resolv_conf, tool_at, tool_for};
use crate::network::netcheck::model::{DpiTool, EnvInfo};

const RESOLV_CONF: &str = "/etc/resolv.conf";
const NAME_BYTES: usize = 64;
const PATH_BYTES: usize = libc::PROC_PIDPATHINFO_MAXSIZE as usize;

pub async fn detect() -> EnvInfo {
    tokio::task::spawn_blocking(|| EnvInfo {
        dpi: running(),
        dns_servers: dns_servers(),
        ..EnvInfo::default()
    })
    .await
    .unwrap_or_default()
}

fn running() -> Vec<DpiTool> {
    let count = unsafe { libc::proc_listallpids(std::ptr::null_mut(), 0) };
    if count <= 0 {
        return Vec::new();
    }
    let mut pids = vec![0 as libc::pid_t; count as usize + 32];
    let bytes = (pids.len() * std::mem::size_of::<libc::pid_t>()) as libc::c_int;
    let filled = unsafe { libc::proc_listallpids(pids.as_mut_ptr().cast(), bytes) };
    if filled <= 0 {
        return Vec::new();
    }
    pids.truncate(filled as usize);
    let mut found: Vec<DpiTool> = Vec::new();
    let mut path = vec![0u8; PATH_BYTES];
    for pid in pids {
        if let Some(tool) = tool_of(pid, &mut path)
            && !found.iter().any(|seen| seen.name == tool)
        {
            found.push(DpiTool {
                name: tool.to_string(),
                args: None,
            });
        }
    }
    found
}

fn tool_of(pid: libc::pid_t, path: &mut [u8]) -> Option<&'static str> {
    let len = unsafe { libc::proc_pidpath(pid, path.as_mut_ptr().cast(), path.len() as u32) };
    if len > 0 {
        return tool_at(&String::from_utf8_lossy(&path[..len as usize]));
    }
    let mut name = [0u8; NAME_BYTES];
    let len = unsafe { libc::proc_name(pid, name.as_mut_ptr().cast(), NAME_BYTES as u32) };
    if len <= 0 {
        return None;
    }
    tool_for(&String::from_utf8_lossy(&name[..len as usize]))
}

fn dns_servers() -> Vec<IpAddr> {
    std::fs::read_to_string(RESOLV_CONF)
        .map(|text| parse_resolv_conf(&text))
        .unwrap_or_default()
}
