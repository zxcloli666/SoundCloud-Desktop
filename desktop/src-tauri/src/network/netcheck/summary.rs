use super::model::{AppProbe, DnsState, NetReport, TargetCheck, TargetId, VolumeProbe};
use super::route::{API, SERVICES};
use crate::network::edge::IMAGES;
use crate::network::fail::{Fail, FailKind, Phase};

const KB: u64 = 1024;
const MB: u64 = 1024 * 1024;
const DOT: &str = " · ";

pub fn lines(report: &NetReport) -> Vec<String> {
    vec![
        format!("works: {}", or_none(works(report))),
        format!("fails: {}", or_none(fails(report))),
        format!("reachable: {}", reachable(report)),
        format!("app: {}", app(report)),
    ]
}

pub fn name(target: &TargetCheck) -> String {
    match (&target.node, target.id) {
        (Some(node), id) => format!("{} {node}", id.as_str()),
        (None, TargetId::Images | TargetId::SoundCloud) => format!("{} direct", target.id.as_str()),
        (None, id) => id.as_str().to_string(),
    }
}

pub fn speed(bytes_per_sec: u64) -> String {
    if bytes_per_sec >= MB {
        format!("{:.1} MB/s", bytes_per_sec as f64 / MB as f64)
    } else {
        format!("{} KB/s", bytes_per_sec / KB)
    }
}

pub fn why(target: &TargetCheck) -> Option<String> {
    if target.ok {
        return None;
    }
    let dns = match target.dns {
        DnsState::Failed => Some("dns: no address from the system resolver or DoH"),
        DnsState::Garbage => Some("dns: the system resolver gives a fake address"),
        DnsState::Spoofed => Some("dns: the system resolver gives a wrong address"),
        DnsState::Sane | DnsState::Unchecked => None,
    };
    let probe = target.probe.as_ref();
    let failure = probe
        .and_then(|probe| probe.fail.as_ref())
        .map(failure)
        .or_else(|| {
            probe
                .and_then(|probe| probe.status)
                .filter(|status| *status >= 500)
                .map(|status| format!("http {status}"))
        })
        .or_else(|| target.app.as_ref().filter(|app| !app.ok).map(answer))
        .or_else(|| {
            let route = target.route.as_ref()?;
            let api = route.services.iter().find(|service| service.service == API);
            Some(match api {
                Some(api) => format!(
                    "the relay answers, the api behind it: {}",
                    answer(&api.probe)
                ),
                None => "the api does not answer through it".to_string(),
            })
        });
    let parts: Vec<String> = dns.map(str::to_string).into_iter().chain(failure).collect();
    Some(if parts.is_empty() {
        "no answer".to_string()
    } else {
        parts.join("; ")
    })
}

pub fn answer(app: &AppProbe) -> String {
    match (&app.fail, app.status) {
        (Some(fail), _) => failure(fail),
        (None, Some(status)) => format!("http {status}"),
        (None, None) => "no answer".to_string(),
    }
}

pub fn failure(fail: &Fail) -> String {
    let phase = fail
        .phase
        .map(|phase| format!("{} ", phase.as_str()))
        .unwrap_or_default();
    let after = fail
        .after_ms
        .map(|ms| format!(" after {ms} ms"))
        .unwrap_or_default();
    let cause = match (fail.kind, fail.phase) {
        (FailKind::Reset | FailKind::Closed, Some(Phase::Tls | Phase::FirstByte))
        | (FailKind::Timeout, Some(Phase::Tls)) => ", looks like DPI",
        (FailKind::TlsCert, _) => ", antivirus or proxy swaps the certificate",
        _ => "",
    };
    format!("{phase}{}{after}{cause}", words(fail.kind))
}

fn words(kind: FailKind) -> &'static str {
    match kind {
        FailKind::Dns => "dns failed",
        FailKind::DnsBogus => "fake dns address",
        FailKind::Timeout => "timeout",
        FailKind::Refused => "refused",
        FailKind::Unreachable => "network unreachable",
        FailKind::Reset => "reset",
        FailKind::Closed => "closed",
        FailKind::TlsCert => "foreign certificate",
        FailKind::Tls => "tls error",
        FailKind::Status => "server error",
        FailKind::Body => "body broke off",
        FailKind::Other => "error",
    }
}

pub fn volume_trouble(volume: &VolumeProbe) -> Option<String> {
    let kb = volume.bytes / KB;
    if volume.cut {
        return Some(format!(
            "{} after {kb} KB, looks like DPI",
            if volume.shape == "blackhole" {
                "stalls"
            } else {
                "cut"
            }
        ));
    }
    match volume.shape.as_str() {
        "clear" => None,
        "slow" => Some(format!("slow, {}", speed(volume.speed))),
        "dead" => Some("no probe answer".to_string()),
        shape => Some(format!("{shape} after {kb} KB")),
    }
}

fn works(report: &NetReport) -> Vec<String> {
    report
        .targets
        .iter()
        .filter(|target| target.ok)
        .map(|target| {
            let pace = match &target.volume {
                Some(volume) if volume.speed > 0 => speed(volume.speed),
                _ => target
                    .total_ms
                    .map_or_else(|| "ok".to_string(), |ms| format!("{ms} ms")),
            };
            format!("{} {pace}", name(target))
        })
        .collect()
}

fn fails(report: &NetReport) -> Vec<String> {
    let mut found = Vec::new();
    for target in &report.targets {
        if let Some(why) = why(target) {
            found.push(format!("{}: {why}", name(target)));
            continue;
        }
        if let Some(trouble) = target.volume.as_ref().and_then(volume_trouble) {
            found.push(format!("{} download: {trouble}", name(target)));
        }
        let Some(route) = &target.route else { continue };
        for service in route.services.iter().filter(|service| !service.probe.ok) {
            found.push(format!(
                "{} via {}: {}",
                service.service,
                target.node.as_deref().unwrap_or("-"),
                answer(&service.probe)
            ));
        }
    }
    found
}

fn reachable(report: &NetReport) -> String {
    SERVICES
        .iter()
        .map(|service| {
            let through: Vec<&str> = report
                .targets
                .iter()
                .filter(|target| target.carries(service.label))
                .filter_map(|target| target.node.as_deref())
                .collect();
            let through = if through.is_empty() {
                "NONE".to_string()
            } else {
                through.join(",")
            };
            format!("{} {through}", service.label)
        })
        .collect::<Vec<_>>()
        .join(DOT)
}

fn app(report: &NetReport) -> String {
    let mut parts = Vec::new();
    match report.edge.pool.first() {
        Some(first) => parts.push(format!(
            "relays {} ({first} first)",
            report.edge.pool.join(",")
        )),
        None => parts.push("no relay pool".to_string()),
    }
    let fastest = report
        .targets
        .iter()
        .filter(|target| target.id == TargetId::Relay)
        .filter_map(|target| Some((target.node.as_deref()?, target.volume.as_ref()?.speed)))
        .filter(|(_, speed)| *speed > 0)
        .max_by_key(|(_, speed)| *speed);
    if let Some((node, bytes)) = fastest {
        parts.push(format!("fastest {node} {}", speed(bytes)));
    }
    let images_pinned = report.edge.pins.iter().any(|(origin, _)| origin == IMAGES);
    parts.push(if images_pinned {
        "images via relays".to_string()
    } else {
        "images direct".to_string()
    });
    if !report.edge.pro.is_empty() {
        parts.push(format!("pro for {}", report.edge.pro.join(",")));
    }
    parts.push(format!("call {}", report.call.as_deref().unwrap_or("-")));
    parts.join(DOT)
}

fn or_none(items: Vec<String>) -> String {
    if items.is_empty() {
        "none".to_string()
    } else {
        items.join(DOT)
    }
}

#[cfg(test)]
#[path = "summary_tests.rs"]
mod tests;
