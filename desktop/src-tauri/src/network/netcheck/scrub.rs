use std::net::{IpAddr, Ipv6Addr};

use crate::app::log_sink;

use super::model::{DnsAnswer, EnvInfo, NetReport, PhaseProbe, TargetCheck};
use crate::network::fail::Fail;

const MAX_VALUE: usize = 2048;
const MAX_VPN: usize = 3;
const MAX_VPN_NAME: usize = 32;
const USER_DIRS: [&str; 3] = ["\\users\\", "/home/", "/users/"];

pub fn capped(text: &str) -> String {
    text.chars().take(MAX_VALUE).collect()
}

pub fn scrub(text: &str) -> String {
    let mut text = log_sink::redact(text);
    if let Some(home) = dirs::home_dir().map(|home| home.to_string_lossy().into_owned())
        && home.len() > 1
    {
        text = text.replace(&home, "~");
    }
    mask_users(&mask_userinfo(&text))
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
mod tests {
    use std::net::IpAddr;

    use super::{capped, env, mask_users, resolver, scrub, value};
    use crate::network::netcheck::model::EnvInfo;

    fn ip(text: &str) -> IpAddr {
        text.parse().unwrap()
    }

    #[test]
    fn v6_resolvers_keep_only_their_network() {
        let table = [
            ("192.168.1.1", "192.168.1.1"),
            ("2a02:6b8:0:1::feed", "2a02:6b8::"),
            ("2001:4860:4860::8888", "2001:4860::"),
            ("fe80::1a2b:3cff:fe4d:5e6f", "fe80::"),
            ("fd12:3456:789a::1", "fd00::"),
            ("::ffff:10.0.0.1", "10.0.0.1"),
        ];
        for (raw, shown) in table {
            assert_eq!(resolver(ip(raw)), ip(shown), "{raw}");
        }
    }

    #[test]
    fn vpn_names_are_scrubbed_short_and_few() {
        let mut info = EnvInfo {
            vpn: vec![
                "WireGuard Tunnel: C:\\Users\\Ivan\\home.conf and a very long tail".to_string(),
                "wg1".to_string(),
                "tun0".to_string(),
                "utun3".to_string(),
            ],
            dns_servers: vec![ip("2a02:6b8:0:1::1"), ip("1.1.1.1"), ip("2a02:6b8:0:2::1")],
            ..EnvInfo::default()
        };
        env(&mut info);
        assert_eq!(info.vpn.len(), 3);
        assert!(info.vpn.iter().all(|name| name.chars().count() <= 32));
        assert!(!info.vpn[0].contains("Ivan"), "{}", info.vpn[0]);
        assert_eq!(info.dns_servers, vec![ip("2a02:6b8::"), ip("1.1.1.1")]);
    }

    #[test]
    fn user_folders_lose_the_user_name() {
        assert_eq!(
            mask_users("\"C:\\Users\\Ivan Petrov\\zapret\\winws.exe\" --wf-tcp=443"),
            "\"C:\\Users\\~\\zapret\\winws.exe\" --wf-tcp=443"
        );
        assert_eq!(mask_users("C:\\users\\ivan\\bin"), "C:\\users\\~\\bin");
        assert_eq!(
            mask_users("/home/ivan/zapret/nfqws --x"),
            "/home/~/zapret/nfqws --x"
        );
        assert_eq!(mask_users("cd /home/ivan --flag"), "cd /home/~ --flag");
        assert_eq!(mask_users("/Users/ivan/Library"), "/Users/~/Library");
        assert_eq!(mask_users("/home/"), "/home/");
        assert_eq!(mask_users("/opt/zapret/config"), "/opt/zapret/config");
    }

    #[test]
    fn the_home_folder_becomes_a_tilde() {
        let Some(home) = dirs::home_dir() else { return };
        let path = home.join("zapret").to_string_lossy().into_owned();
        assert!(scrub(&path).starts_with('~'), "{}", scrub(&path));
    }

    #[test]
    fn secrets_are_redacted() {
        let text = scrub(
            "GET https://api.scnative.space/me?session_id=abc123 Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.x",
        );
        assert!(!text.contains("abc123"), "{text}");
        assert!(!text.contains("eyJhbGciOiJIUzI1NiJ9"), "{text}");
    }

    #[test]
    fn proxy_credentials_are_masked() {
        assert_eq!(
            scrub("proxy http://ivan:secret@10.0.0.1:3128/ failed"),
            "proxy http://***@10.0.0.1:3128/ failed"
        );
        assert_eq!(
            scrub("https://api.scnative.space/health"),
            "https://api.scnative.space/health"
        );
        assert_eq!(scrub("socks5://u@h"), "socks5://***@h");
    }

    #[test]
    fn values_are_capped() {
        assert_eq!(capped(&"x".repeat(5000)).len(), 2048);
        assert_eq!(value(&"y".repeat(3000)).len(), 2048);
    }
}
