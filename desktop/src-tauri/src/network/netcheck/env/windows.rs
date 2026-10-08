use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::PathBuf;
use std::time::Duration;

use windows_registry::LOCAL_MACHINE;

use super::{netsh_timestamps, tool_for};
use crate::network::netcheck::model::{DpiTool, EnvInfo, ServiceInfo};

const ZAPRET_SERVICES: [&str; 5] = [
    "zapret",
    "winws1",
    "winws2",
    "GoodbyeDPI",
    "discordfix_zapret",
];
const DRIVER_SERVICES: [&str; 2] = ["WinDivert", "WinDivert14"];
const STRATEGY_VALUES: [&str; 2] = ["zapret-discord-youtube", "Zapret2NextStrategy"];
const NETSH_TIMEOUT: Duration = Duration::from_secs(3);
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub async fn detect() -> EnvInfo {
    let scanned = tokio::task::spawn_blocking(|| (running(), services(), dns_servers()));
    let (scanned, tcp_timestamps) = tokio::join!(scanned, netsh());
    let (dpi, services, dns_servers) = scanned.unwrap_or_default();
    EnvInfo {
        dpi,
        services,
        tcp_timestamps,
        dns_servers,
        ..EnvInfo::default()
    }
}

async fn netsh() -> Option<String> {
    let root =
        std::env::var_os("SystemRoot").map_or_else(|| PathBuf::from("C:\\Windows"), PathBuf::from);
    let mut command = tokio::process::Command::new(root.join("System32").join("netsh.exe"));
    command
        .args(["interface", "tcp", "show", "global"])
        .stdin(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .kill_on_drop(true)
        .creation_flags(CREATE_NO_WINDOW);
    let output = tokio::time::timeout(NETSH_TIMEOUT, command.output())
        .await
        .ok()?
        .ok()?;
    netsh_timestamps(&output.stdout)
}

fn services() -> Vec<ServiceInfo> {
    ZAPRET_SERVICES
        .iter()
        .chain(DRIVER_SERVICES.iter())
        .filter_map(|name| service(name))
        .collect()
}

fn service(name: &str) -> Option<ServiceInfo> {
    let key = LOCAL_MACHINE
        .open(format!("SYSTEM\\CurrentControlSet\\Services\\{name}"))
        .ok()?;
    Some(ServiceInfo {
        name: name.to_string(),
        image: key.get_string("ImagePath").ok(),
        strategy: STRATEGY_VALUES
            .iter()
            .find_map(|value| key.get_string(value).ok()),
        start: key.get_u32("Start").ok(),
    })
}

fn running() -> Vec<DpiTool> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW,
        TH32CS_SNAPPROCESS,
    };

    let mut found: Vec<DpiTool> = Vec::new();
    unsafe {
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot == INVALID_HANDLE_VALUE {
            return found;
        }
        let mut entry: PROCESSENTRY32W = std::mem::zeroed();
        entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut more = Process32FirstW(snapshot, &mut entry);
        while more != 0 {
            let len = entry
                .szExeFile
                .iter()
                .position(|unit| *unit == 0)
                .unwrap_or(entry.szExeFile.len());
            let name = String::from_utf16_lossy(&entry.szExeFile[..len]);
            if let Some(tool) = tool_for(&name)
                && !found.iter().any(|seen| seen.name == tool)
            {
                found.push(DpiTool {
                    name: tool.to_string(),
                    args: None,
                });
            }
            more = Process32NextW(snapshot, &mut entry);
        }
        CloseHandle(snapshot);
    }
    found
}

fn dns_servers() -> Vec<IpAddr> {
    use windows_sys::Win32::Foundation::ERROR_BUFFER_OVERFLOW;
    use windows_sys::Win32::NetworkManagement::IpHelper::{
        GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_FRIENDLY_NAME, GAA_FLAG_SKIP_MULTICAST,
        GetAdaptersAddresses, IP_ADAPTER_ADDRESSES_LH,
    };
    use windows_sys::Win32::NetworkManagement::Ndis::IfOperStatusUp;
    use windows_sys::Win32::Networking::WinSock::{
        AF_INET, AF_INET6, AF_UNSPEC, SOCKADDR_IN, SOCKADDR_IN6,
    };

    let flags = GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_FRIENDLY_NAME;
    let mut size: u32 = 16 * 1024;
    let mut buffer: Vec<u64> = Vec::new();
    let mut filled = false;
    for _ in 0..3 {
        buffer = vec![0u64; (size as usize).div_ceil(8)];
        let rc = unsafe {
            GetAdaptersAddresses(
                AF_UNSPEC as u32,
                flags,
                std::ptr::null(),
                buffer.as_mut_ptr().cast(),
                &mut size,
            )
        };
        if rc == 0 {
            filled = true;
            break;
        }
        if rc != ERROR_BUFFER_OVERFLOW {
            return Vec::new();
        }
    }
    if !filled {
        return Vec::new();
    }
    let mut found = Vec::new();
    let mut adapter = buffer.as_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
    while !adapter.is_null() {
        let current = unsafe { &*adapter };
        if current.OperStatus == IfOperStatusUp {
            let mut dns = current.FirstDnsServerAddress;
            while !dns.is_null() {
                let entry = unsafe { &*dns };
                let sockaddr = entry.Address.lpSockaddr;
                if !sockaddr.is_null() {
                    let family = unsafe { (*sockaddr).sa_family };
                    if family == AF_INET {
                        let v4 = unsafe { &*(sockaddr as *const SOCKADDR_IN) };
                        let raw = unsafe { v4.sin_addr.S_un.S_addr };
                        found.push(IpAddr::V4(Ipv4Addr::from(raw.to_ne_bytes())));
                    } else if family == AF_INET6 {
                        let v6 = unsafe { &*(sockaddr as *const SOCKADDR_IN6) };
                        found.push(IpAddr::V6(Ipv6Addr::from(unsafe { v6.sin6_addr.u.Byte })));
                    }
                }
                dns = entry.Next;
            }
        }
        adapter = current.Next;
    }
    found.sort();
    found.dedup();
    found
}
