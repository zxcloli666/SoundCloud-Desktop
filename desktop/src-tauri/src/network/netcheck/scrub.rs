use std::net::{IpAddr, Ipv6Addr};

use crate::app::log_sink;

use super::model::{DnsAnswer, EnvInfo, NetReport, PhaseProbe, TargetCheck};
use crate::network::fail::Fail;

const MAX_VALUE: usize = 2048;
const MAX_VPN: usize = 3;
const MAX_VPN_NAME: usize = 32;
const USER_DIRS: [&str; 3] = ["\\users\\", "/home/", "/users/"];
const LIST_FLAGS: [&str; 4] = [
    "--hostlist-domains=",
    "--hostlist-exclude-domains=",
    "--ipset-ip=",
    "--ipset-exclude-ip=",
];

pub fn capped(text: &str) -> String {
    text.chars().take(MAX_VALUE).collect()
}

pub fn scrub(text: &str) -> String {
    let home = dirs::home_dir().map(|home| home.to_string_lossy().into_owned());
    scrub_with(text, home.as_deref())
}

fn scrub_with(text: &str, home: Option<&str>) -> String {
    let mut text = mask_lists(&log_sink::redact(text));
    if let Some(home) = home.filter(|home| home.len() > 1) {
        text = mask_home(&text, home);
    }
    mask_users(&mask_userinfo(&text))
}

fn mask_home(text: &str, home: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(found) = rest.find(home) {
        let end = found + home.len();
        out.push_str(&rest[..found]);
        let whole = rest[end..]
            .chars()
            .next()
            .is_none_or(|next| matches!(next, '/' | '\\' | '"' | '\'') || next.is_whitespace());
        out.push_str(if whole { "~" } else { home });
        rest = &rest[end..];
    }
    out.push_str(rest);
    out
}

fn mask_lists(text: &str) -> String {
    LIST_FLAGS
        .iter()
        .fold(text.to_string(), |text, flag| mask_list(&text, flag))
}

fn mask_list(text: &str, flag: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(found) = rest.find(flag) {
        let start = found + flag.len();
        out.push_str(&rest[..start]);
        let tail = &rest[start..];
        let open = tail.len() - tail.trim_start_matches(['"', '\'']).len();
        let body = &tail[open..];
        let len = body
            .find(|c: char| c.is_whitespace() || matches!(c, '"' | '\''))
            .unwrap_or(body.len());
        let items = body[..len]
            .split(',')
            .filter(|item| !item.trim().is_empty())
            .count();
        out.push_str(&tail[..open]);
        let plural = if items == 1 { "" } else { "s" };
        out.push_str(&format!("<{items} item{plural}>"));
        rest = &body[len..];
    }
    out.push_str(rest);
    out
}

fn mask_userinfo(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(found) = rest.find("://") {
        let authority_start = found + 3;
        out.push_str(&rest[..authority_start]);
        let tail = &rest[authority_start..];
        let authority_len = tail
            .find(|c: char| matches!(c, '/' | '?' | '#' | '"' | '\'') || c.is_whitespace())
            .unwrap_or(tail.len());
        let authority = &tail[..authority_len];
        match authority.rfind('@') {
            Some(at) => {
                out.push_str("***");
                out.push_str(&authority[at..]);
            }
            None => out.push_str(authority),
        }
        rest = &tail[authority_len..];
    }
    out.push_str(rest);
    out
}

fn mask_users(text: &str) -> String {
    USER_DIRS
        .iter()
        .fold(text.to_string(), |text, marker| mask_after(&text, marker))
}

pub fn value(text: &str) -> String {
    capped(&scrub(text))
}

fn mask_after(text: &str, marker: &str) -> String {
    let lower = text.to_ascii_lowercase();
    let mut out = String::with_capacity(text.len());
    let mut at = 0;
    while let Some(found) = lower[at..].find(marker) {
        let name_start = at + found + marker.len();
        out.push_str(&text[at..name_start]);
        let name_len = name_len(&text[name_start..]);
        if name_len > 0 {
            out.push('~');
        }
        at = name_start + name_len;
    }
    out.push_str(&text[at..]);
    out
}

fn name_len(rest: &str) -> usize {
    let mut chars = rest.char_indices().peekable();
    while let Some((at, c)) = chars.next() {
        if matches!(c, '\\' | '/' | '"' | '\'' | '\n' | '\r' | '\t') {
            return at;
        }
        if c == ' '
            && chars
                .peek()
                .is_none_or(|(_, next)| matches!(next, '-' | ' '))
        {
            return at;
        }
    }
    rest.len()
}

fn fail(fail: &mut Option<Fail>) {
    if let Some(fail) = fail
        && let Some(detail) = fail.detail.as_mut()
    {
        *detail = value(detail);
    }
}

fn answer(answer: &mut DnsAnswer) {
    fail(&mut answer.fail);
}

fn probe(probe: &mut Option<PhaseProbe>) {
    if let Some(probe) = probe {
        fail(&mut probe.fail);
        probe.cert_issuer = probe.cert_issuer.as_deref().map(value);
    }
}

fn env(env: &mut EnvInfo) {
    for tool in &mut env.dpi {
        tool.args = tool.args.as_deref().map(value);
    }
    for service in &mut env.services {
        service.image = service.image.as_deref().map(value);
        service.strategy = service.strategy.as_deref().map(value);
    }
    if let Some(config) = env.zapret_config.as_mut() {
        for entry in config.values.values_mut() {
            *entry = value(entry);
        }
    }
    env.notes = env.notes.iter().map(|note| value(note)).collect();
    env.vpn = env
        .vpn
        .iter()
        .take(MAX_VPN)
        .map(|name| value(name).chars().take(MAX_VPN_NAME).collect())
        .collect();
    let mut servers: Vec<IpAddr> = Vec::new();
    for ip in env.dns_servers.iter().map(|ip| resolver(*ip)) {
        if !servers.contains(&ip) {
            servers.push(ip);
        }
    }
    env.dns_servers = servers;
}

pub fn resolver(ip: IpAddr) -> IpAddr {
    let IpAddr::V6(v6) = ip else { return ip };
    if let Some(v4) = v6.to_ipv4_mapped() {
        return IpAddr::V4(v4);
    }
    let [first, second, ..] = v6.segments();
    let kept = if first & 0xFFC0 == 0xFE80 {
        [0xFE80, 0]
    } else if first & 0xFE00 == 0xFC00 {
        [first & 0xFF00, 0]
    } else {
        [first, second]
    };
    IpAddr::V6(Ipv6Addr::new(kept[0], kept[1], 0, 0, 0, 0, 0, 0))
}

pub fn target(target: &mut TargetCheck) {
    answer(&mut target.system);
    if let Some(doh) = target.doh.as_mut() {
        answer(doh);
    }
    probe(&mut target.probe);
    probe(&mut target.doh_probe);
    if let Some(app) = target.app.as_mut() {
        fail(&mut app.fail);
    }
}

pub fn report(report: &mut NetReport) {
    report.reason = report.reason.as_deref().map(value);
    for check in &mut report.targets {
        target(check);
    }
    for doh in &mut report.doh {
        fail(&mut doh.fail);
    }
    if let Some(info) = report.env.as_mut() {
        env(info);
    }
}

#[cfg(test)]
#[path = "scrub_tests.rs"]
mod tests;
