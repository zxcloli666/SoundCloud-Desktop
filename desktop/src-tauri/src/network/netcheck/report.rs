use std::net::IpAddr;

use chrono::{Local, TimeZone};

use super::model::{
    AppProbe, DnsAnswer, DnsState, DohProbe, EdgeSnapshot, EnvInfo, NetReport, PathEvent,
    PhaseProbe, TargetCheck,
};
use crate::network::edge::Tier;
use crate::network::fail::{Fail, Phase};

const MAX_TEXT: usize = 8 * 1024;
const MAX_ARGS: usize = 160;
const TITLE: &str = "SoundCloud Desktop network check";
const DOT: &str = " · ";

pub fn text(report: &NetReport) -> String {
    let mut head = vec![
        TITLE.to_string(),
        app_line(report),
        format!(
            "verdict: {}{DOT}hint: {}{DOT}remote: {}{DOT}internet: {}",
            report.verdict.as_str(),
            report.hint.as_str(),
            report.remote.as_str(),
            report.internet.as_str()
        ),
    ];
    if let Some(env) = &report.env {
        head.push(env_line(env));
        head.push(dns_line(&env.dns_servers, &report.doh));
    }
    head.extend(report.targets.iter().map(target_line));
    head.push(edge_line(&report.edge));
    let mut recent: Vec<String> = report.recent.iter().map(event_line).collect();
    let mut text = assemble(&head, &recent);
    while text.len() > MAX_TEXT && !recent.is_empty() {
        recent.pop();
        text = assemble(&head, &recent);
    }
    cut(&text, MAX_TEXT)
}

pub fn log_lines(report: &NetReport) -> Vec<String> {
    let env = report.env.as_ref();
    let mut lines = vec![format!(
        "[NetCheck] verdict={} hint={} trigger={} reason={} remote={} internet={} dpi={} ts={} proxy={} vpn={} took={}ms",
        report.verdict.as_str(),
        report.hint.as_str(),
        report.trigger.as_str(),
        report.reason.as_deref().unwrap_or("-"),
        report.remote.as_str(),
        report.internet.as_str(),
        listed(
            env.map(|env| env.dpi.iter().map(|tool| tool.name.clone()).collect())
                .unwrap_or_default()
        ),
        env.and_then(|env| env.tcp_timestamps.as_deref())
            .unwrap_or("-"),
        yes_no(env.is_some_and(|env| env.proxy)),
        listed(env.map(|env| env.vpn.clone()).unwrap_or_default()),
        report.duration_ms,
    )];
    if let Some(env) = env {
        lines.push(format!("[NetCheck] {}", env_line(env)));
        lines.push(format!(
            "[NetCheck] {}",
            dns_line(&env.dns_servers, &report.doh)
        ));
    }
    lines.extend(report.targets.iter().map(|target| {
        format!(
            "[NetCheck] {} {} {}",
            label(target),
            target.host,
            target_parts(target, "=").join(" ")
        )
    }));
    lines
}

fn assemble(head: &[String], recent: &[String]) -> String {
    let mut lines = head.to_vec();
    if !recent.is_empty() {
        lines.push("recent:".to_string());
        lines.extend(recent.iter().cloned());
    }
    lines.join("\n")
}

fn cut(text: &str, max: usize) -> String {
    if text.len() <= max {
        return text.to_string();
    }
    let mut end = max;
    while !text.is_char_boundary(end) {
        end -= 1;
    }
    text[..end].to_string()
}

fn short(text: &str) -> String {
    if text.chars().count() <= MAX_ARGS {
        return text.to_string();
    }
    let head: String = text.chars().take(MAX_ARGS).collect();
    format!("{head} ...")
}

fn listed(items: Vec<String>) -> String {
    joined(items, ",")
}

fn joined(items: Vec<String>, sep: &str) -> String {
    if items.is_empty() {
        "-".to_string()
    } else {
        items.join(sep)
    }
}

fn yes_no(flag: bool) -> &'static str {
    if flag { "yes" } else { "no" }
}

fn time(at_ms: u64, format: &str) -> String {
    Local
        .timestamp_millis_opt(at_ms as i64)
        .single()
        .map(|at| at.format(format).to_string())
        .unwrap_or_else(|| "-".to_string())
}

fn app_line(report: &NetReport) -> String {
    let trigger = match &report.reason {
        Some(reason) => format!("{} ({reason})", report.trigger.as_str()),
        None => report.trigger.as_str().to_string(),
    };
    format!(
        "app {}{DOT}{} {}{DOT}{}{DOT}{}{DOT}{trigger}{DOT}{:.1} s",
        report.app.version,
        report.app.os,
        report.app.arch,
        report.app.install,
        time(report.at_ms, "%Y-%m-%d %H:%M"),
        f64::from(report.duration_ms) / 1000.0
    )
}

fn env_line(env: &EnvInfo) -> String {
    let mut parts: Vec<String> = Vec::new();
    for tool in &env.dpi {
        match &tool.args {
            Some(args) => parts.push(format!("{}: \"{}\"", tool.name, short(args))),
            None => parts.push(tool.name.clone()),
        }
    }
    for service in &env.services {
        let mut part = format!("service {}", service.name);
        if let Some(image) = &service.image {
            part.push_str(&format!(": \"{}\"", short(image)));
        }
        if let Some(strategy) = &service.strategy {
            part.push_str(&format!(" ({})", short(strategy)));
        }
        if let Some(start) = service.start {
            part.push_str(&format!(" start={start}"));
        }
        parts.push(part);
    }
    if let Some(config) = &env.zapret_config {
        let values: Vec<String> = config
            .values
            .iter()
            .map(|(key, value)| format!("{key}={}", short(value)))
            .collect();
        parts.push(format!("config {}: {}", config.path, values.join(" ")));
    }
    if !env.units.is_empty() {
        parts.push(format!("units {}", env.units.join(",")));
    }
    if parts.is_empty() {
        parts.push("no dpi tools".to_string());
    }
    parts.push(format!(
        "tcp timestamps: {}",
        env.tcp_timestamps.as_deref().unwrap_or("-")
    ));
    let env_proxy = if env.env_proxy.is_empty() {
        String::new()
    } else {
        format!(" (env {})", env.env_proxy.join(","))
    };
    parts.push(format!("proxy: {}{env_proxy}", yes_no(env.proxy)));
    parts.push(format!("vpn: {}", listed(env.vpn.clone())));
    if let Some(sandbox) = &env.sandbox {
        parts.push(format!("sandbox: {sandbox}"));
    }
    if !env.notes.is_empty() {
        parts.push(format!("notes: {}", env.notes.join(",")));
    }
    format!("env: {}", parts.join(DOT))
}

fn dns_line(servers: &[IpAddr], doh: &[DohProbe]) -> String {
    let servers = listed(servers.iter().map(IpAddr::to_string).collect());
    let doh = joined(
        doh.iter()
            .map(|probe| {
                let outcome = match (&probe.fail, probe.ms) {
                    (Some(fail), _) => format!("fail {}", fail.kind.as_str()),
                    (None, Some(ms)) => format!("ok {ms}ms"),
                    (None, None) => "ok".to_string(),
                };
                format!("{} {outcome}", probe.provider)
            })
            .collect(),
        ", ",
    );
    format!("dns servers: {servers}{DOT}doh: {doh}")
}

fn label(target: &TargetCheck) -> String {
    match &target.node {
        Some(node) => format!("relay {node}"),
        None => target.id.as_str().to_string(),
    }
}

fn target_line(target: &TargetCheck) -> String {
    format!(
        "{:<8} {:<34} {}",
        label(target),
        target.host,
        target_parts(target, " ").join(DOT)
    )
}

fn target_parts(target: &TargetCheck, sep: &str) -> Vec<String> {
    let mut parts = Vec::new();
    if target.proxied {
        parts.push("via proxy".to_string());
    }
    parts.push(format!("sys{sep}{}", answer(&target.system)));
    parts.push(format!(
        "doh{sep}{}",
        target.doh.as_ref().map_or_else(|| "-".to_string(), answer)
    ));
    if target.dns != DnsState::Sane {
        parts.push(format!("dns{sep}{}", dns_state(target.dns)));
    }
    if let Some(probe) = &target.probe {
        parts.push(format!(
            "tcp{sep}{}",
            phase(probe, Phase::Tcp, probe.tcp_ms)
        ));
        parts.push(format!(
            "tls{sep}{}",
            phase(probe, Phase::Tls, probe.tls_ms)
        ));
        parts.push(format!("http{sep}{}", http(probe)));
        if let Some(issuer) = &probe.cert_issuer {
            parts.push(format!("cert{sep}\"{issuer}\""));
        }
        if probe.tcp_timestamps == Some(false) {
            parts.push(format!("ts{sep}off"));
        }
        if let Some(retrans) = probe.syn_retrans.filter(|count| *count > 0) {
            parts.push(format!("syn-retrans{sep}{retrans}"));
        }
    }
    if let Some(probe) = &target.doh_probe {
        parts.push(format!("doh-ip{sep}{}", outcome(probe)));
    }
    if let Some(app) = &target.app {
        parts.push(format!("app{sep}{}", app_outcome(app)));
    }
    parts
}

fn answer(answer: &DnsAnswer) -> String {
    match &answer.fail {
        Some(fail) => fail.kind.as_str().to_string(),
        None if answer.addrs.is_empty() => "none".to_string(),
        None => listed(answer.addrs.iter().map(IpAddr::to_string).collect()),
    }
}

fn dns_state(state: DnsState) -> &'static str {
    match state {
        DnsState::Sane => "sane",
        DnsState::Garbage => "garbage",
        DnsState::Spoofed => "spoofed",
        DnsState::Failed => "failed",
        DnsState::Unchecked => "unchecked",
    }
}

fn failure(fail: &Fail) -> String {
    match fail.after_ms {
        Some(ms) => format!("{}@{ms}ms", fail.kind.as_str()),
        None => fail.kind.as_str().to_string(),
    }
}

fn phase(probe: &PhaseProbe, phase: Phase, ms: Option<u32>) -> String {
    if let Some(ms) = ms {
        return format!("{ms}ms");
    }
    match &probe.fail {
        Some(fail) if fail.phase == Some(phase) => failure(fail),
        _ => "-".to_string(),
    }
}

fn http(probe: &PhaseProbe) -> String {
    match (probe.status, probe.first_byte_ms) {
        (Some(status), Some(ms)) => format!("{status}/{ms}ms"),
        (None, Some(ms)) => format!("?/{ms}ms"),
        _ => phase(probe, Phase::FirstByte, None),
    }
}

fn outcome(probe: &PhaseProbe) -> String {
    match &probe.fail {
        Some(fail) => failure(fail),
        None if probe.passed() => "ok".to_string(),
        None => probe
            .status
            .map_or_else(|| "-".to_string(), |status| status.to_string()),
    }
}

fn app_outcome(app: &AppProbe) -> String {
    match (&app.fail, app.status) {
        (Some(fail), _) => failure(fail),
        (None, Some(status)) => match app.ms {
            Some(ms) => format!("{status}/{ms}ms"),
            None => status.to_string(),
        },
        (None, None) => "-".to_string(),
    }
}

fn edge_line(edge: &EdgeSnapshot) -> String {
    let pins = joined(
        edge.pins
            .iter()
            .map(|(origin, left_ms)| format!("{origin} relay {}m left", left_ms.div_ceil(60_000)))
            .collect(),
        ", ",
    );
    format!("edge: {pins}{DOT}pool {}", joined(edge.pool.clone(), " "))
}

fn event_line(event: &PathEvent) -> String {
    let tier = match event.tier {
        Tier::Direct => "direct",
        Tier::Relay => "relay",
    };
    let result = match (event.ok, event.fail, event.status) {
        (true, _, Some(status)) => format!("ok {status}"),
        (true, _, None) => "ok".to_string(),
        (false, Some(kind), _) => format!("fail {}", kind.as_str()),
        (false, None, Some(status)) => format!("fail {status}"),
        (false, None, None) => "fail".to_string(),
    };
    let ms = event.ms.map_or_else(String::new, |ms| format!(" {ms}ms"));
    format!(
        "{} {} {tier} {} {result}{ms} ({})",
        time(event.at_ms, "%H:%M:%S"),
        event.origin,
        event.role.as_str(),
        event.source
    )
}

#[cfg(test)]
mod tests {
    use super::{log_lines, text};
    use crate::network::netcheck::fixture::{sample, troubled};

    #[test]
    fn a_full_report_stays_short_and_names_the_failure() {
        let report = troubled();
        let text = text(&report);
        assert!(text.len() <= 8 * 1024, "{}", text.len());
        assert!(text.starts_with("SoundCloud Desktop network check\n"));
        assert!(text.contains("verdict: reset"));
        assert!(text.contains("hint: zapret-timestamps"));
        assert!(text.contains("tls reset@12ms"), "{text}");
        assert!(text.contains("service zapret"));
        assert!(text.contains("recent:"));
        assert!(!text.to_lowercase().contains("session"), "{text}");
    }

    #[test]
    fn many_events_are_trimmed_to_fit() {
        let mut report = troubled();
        let event = report.recent[0].clone();
        report.recent = (0..400).map(|_| event.clone()).collect();
        let text = text(&report);
        assert!(text.len() <= 8 * 1024);
        assert!(text.contains("recent:"));
    }

    #[test]
    fn the_log_gets_one_header_and_one_line_per_target() {
        let report = troubled();
        let lines = log_lines(&report);
        assert_eq!(lines.len(), report.targets.len() + 3);
        assert!(lines[0].starts_with(
            "[NetCheck] verdict=reset hint=zapret-timestamps trigger=auto reason=edge-pin"
        ));
        assert!(
            lines[1].starts_with("[NetCheck] env: winws"),
            "{}",
            lines[1]
        );
        assert!(
            lines[2].starts_with("[NetCheck] dns servers: 192.168.1.1"),
            "{}",
            lines[2]
        );
        assert!(lines[3].contains("tls=reset@12ms"), "{}", lines[3]);
        assert!(lines[3].contains("ts=off"));
        let quiet = log_lines(&sample(1));
        assert!(
            quiet[0].contains("dpi=- ts=- proxy=no vpn=-"),
            "{}",
            quiet[0]
        );
    }
}
