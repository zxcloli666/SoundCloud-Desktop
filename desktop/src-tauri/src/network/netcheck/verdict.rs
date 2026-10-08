use super::env::uses_ts_fooling;
use super::model::{
    DnsAnswer, DnsState, EnvInfo, Hint, Internet, PhaseProbe, Remote, TargetCheck, TargetId, Tone,
    Verdict,
};
use crate::network::dns;
use crate::network::fail::{FailKind, Phase};

const TS_CONFIG_KEYS: [&str; 2] = ["NFQWS_OPT", "NFQWS2_OPT"];
const TIMESTAMPS_ON: &str = "enabled";

pub fn verdict(targets: &[TargetCheck], internet: Internet, remote: Remote) -> Verdict {
    if targets.is_empty() {
        return Verdict::Unknown;
    }
    if targets.iter().all(|target| target.ok) {
        return Verdict::Ok;
    }
    if targets
        .iter()
        .all(|target| target.ok || target.id == TargetId::Relay)
    {
        return Verdict::BackupDown;
    }
    if internet == Internet::Offline {
        return Verdict::Offline;
    }
    if targets
        .iter()
        .any(|target| matches!(target.dns, DnsState::Garbage | DnsState::Spoofed))
    {
        return Verdict::Dns;
    }
    if targets.iter().any(certificate_swapped) {
        return Verdict::Cert;
    }
    if remote == Remote::Down {
        return Verdict::Down;
    }
    let ok = |id: TargetId| targets.iter().any(|target| target.id == id && target.ok);
    if ok(TargetId::Main) {
        return Verdict::Partial;
    }
    if ok(TargetId::Relay) {
        return Verdict::RelayOnly;
    }
    tally(targets)
}

fn tally(targets: &[TargetCheck]) -> Verdict {
    let (mut reset, mut timeout, mut status, mut dns) = (0, 0, 0, 0);
    for kind in targets.iter().filter_map(failure_kind) {
        match kind {
            FailKind::Reset | FailKind::Closed | FailKind::Refused | FailKind::Tls => reset += 1,
            FailKind::Timeout | FailKind::Unreachable => timeout += 1,
            FailKind::Status => status += 1,
            FailKind::Dns | FailKind::DnsBogus => dns += 1,
            FailKind::TlsCert | FailKind::Body | FailKind::Other => {}
        }
    }
    if reset > 0 && reset >= timeout {
        Verdict::Reset
    } else if timeout > 0 {
        Verdict::Timeout
    } else if status > 0 {
        Verdict::Down
    } else if dns > 0 {
        Verdict::DnsFailed
    } else {
        Verdict::Unknown
    }
}

fn server_error(status: Option<u16>) -> bool {
    status.is_some_and(|status| status >= 500)
}

pub fn failure_kind(target: &TargetCheck) -> Option<FailKind> {
    if target.ok {
        return None;
    }
    let app = target.app.as_ref().and_then(|app| {
        app.fail
            .as_ref()
            .map(|fail| fail.kind)
            .or_else(|| server_error(app.status).then_some(FailKind::Status))
    });
    let probe = target.probe.as_ref().and_then(|probe| {
        probe
            .fail
            .as_ref()
            .map(|fail| fail.kind)
            .or_else(|| server_error(probe.status).then_some(FailKind::Status))
    });
    match (app, probe) {
        (Some(FailKind::Other) | None, Some(probe)) => Some(probe),
        (app, _) => app,
    }
}

fn certificate_swapped(target: &TargetCheck) -> bool {
    let probes = [&target.probe, &target.doh_probe];
    let probed = probes
        .iter()
        .filter_map(|probe| probe.as_ref())
        .any(|probe| {
            probe
                .fail
                .as_ref()
                .is_some_and(|fail| fail.kind == FailKind::TlsCert)
        });
    let app = target
        .app
        .as_ref()
        .and_then(|app| app.fail.as_ref())
        .is_some_and(|fail| fail.kind == FailKind::TlsCert);
    probed || app
}

pub fn hint(verdict: Verdict, env: Option<&EnvInfo>, targets: &[TargetCheck]) -> Hint {
    if !matches!(
        verdict,
        Verdict::Reset | Verdict::Timeout | Verdict::RelayOnly
    ) {
        return Hint::None;
    }
    let Some(env) = env.filter(|env| !env.dpi.is_empty()) else {
        return Hint::None;
    };
    if ts_strategy(env) && timestamps_off(env, targets) {
        Hint::ZapretTimestamps
    } else {
        Hint::Zapret
    }
}

fn ts_strategy(env: &EnvInfo) -> bool {
    let args = env.dpi.iter().filter_map(|tool| tool.args.as_deref());
    let services = env
        .services
        .iter()
        .flat_map(|service| [service.image.as_deref(), service.strategy.as_deref()])
        .flatten();
    let config = env.zapret_config.iter().flat_map(|config| {
        TS_CONFIG_KEYS
            .iter()
            .filter_map(|key| config.values.get(*key).map(String::as_str))
    });
    args.chain(services).chain(config).any(uses_ts_fooling)
}

fn timestamps_off(env: &EnvInfo, targets: &[TargetCheck]) -> bool {
    env.tcp_timestamps
        .as_deref()
        .is_some_and(|value| value != TIMESTAMPS_ON)
        || targets
            .iter()
            .flat_map(|target| [&target.probe, &target.doh_probe])
            .filter_map(|probe| probe.as_ref())
            .any(|probe| probe.tcp_timestamps == Some(false))
}

pub fn dns_state(
    system: &DnsAnswer,
    doh: Option<&DnsAnswer>,
    system_probe_ok: Option<bool>,
    doh_probe_ok: Option<bool>,
) -> DnsState {
    let doh_addrs = doh
        .map(|answer| answer.addrs.as_slice())
        .unwrap_or_default();
    if !sane(system) {
        return if doh_addrs.is_empty() {
            DnsState::Failed
        } else {
            DnsState::Garbage
        };
    }
    let spoofed =
        disjoint(system, doh) && system_probe_ok == Some(false) && doh_probe_ok == Some(true);
    if spoofed {
        DnsState::Spoofed
    } else {
        DnsState::Sane
    }
}

pub fn sane(answer: &DnsAnswer) -> bool {
    answer.fail.is_none() && answer.addrs.iter().any(|ip| !dns::garbage(*ip))
}

pub fn disjoint(system: &DnsAnswer, doh: Option<&DnsAnswer>) -> bool {
    let Some(doh) = doh else {
        return false;
    };
    !system.addrs.is_empty()
        && !doh.addrs.is_empty()
        && !system.addrs.iter().any(|ip| dns::tunnelled(*ip))
        && !system.addrs.iter().any(|ip| doh.addrs.contains(ip))
}

pub fn cells(check: &TargetCheck) -> [Tone; 4] {
    let dns = match check.dns {
        DnsState::Sane => Tone::Ok,
        DnsState::Garbage | DnsState::Spoofed => Tone::Warn,
        DnsState::Failed => Tone::Fail,
        DnsState::Unchecked => Tone::Skip,
    };
    let app_ok = check.app.as_ref().map(|app| app.ok);
    let app_tone = match app_ok {
        Some(true) => Tone::Ok,
        Some(false) => Tone::Fail,
        None => Tone::Skip,
    };
    if check.proxied {
        return [dns, Tone::Skip, Tone::Skip, app_tone];
    }
    let Some(probe) = &check.probe else {
        return [dns, Tone::Skip, Tone::Skip, app_tone];
    };
    [
        dns,
        tcp_tone(probe),
        tls_tone(probe),
        http_tone(probe, app_ok),
    ]
}

fn failed_in(probe: &PhaseProbe, phase: Phase) -> bool {
    probe.fail.as_ref().and_then(|fail| fail.phase) == Some(phase)
}

fn tcp_tone(probe: &PhaseProbe) -> Tone {
    if probe.tcp_ms.is_some() {
        Tone::Ok
    } else if failed_in(probe, Phase::Tcp) {
        Tone::Fail
    } else {
        Tone::Skip
    }
}

fn tls_tone(probe: &PhaseProbe) -> Tone {
    if probe.tls_ms.is_some() {
        Tone::Ok
    } else if failed_in(probe, Phase::Tls) {
        Tone::Fail
    } else {
        Tone::Skip
    }
}

fn http_tone(probe: &PhaseProbe, app_ok: Option<bool>) -> Tone {
    match probe.status {
        Some(status) if status >= 500 => Tone::Warn,
        Some(_) if app_ok == Some(false) => Tone::Warn,
        Some(_) => Tone::Ok,
        None if app_ok == Some(true) => Tone::Ok,
        None if failed_in(probe, Phase::FirstByte) => Tone::Fail,
        None => Tone::Skip,
    }
}

#[cfg(test)]
#[path = "verdict_tests.rs"]
mod tests;
