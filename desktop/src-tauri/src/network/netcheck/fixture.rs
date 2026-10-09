use std::net::IpAddr;

use super::model::{
    AppInfo, AppProbe, DnsAnswer, DnsState, DohProbe, DpiTool, EdgeSnapshot, EnvInfo, Hint,
    Internet, NetReport, PathEvent, PhaseProbe, REPORT_VERSION, Remote, Role, ServiceInfo,
    TargetCheck, TargetId, Tone, Trigger, Verdict,
};
use crate::network::edge::Tier;
use crate::network::fail::{Fail, FailKind, Phase};

pub fn sample(at_ms: u64) -> NetReport {
    NetReport {
        version: REPORT_VERSION,
        at_ms,
        trigger: Trigger::Manual,
        reason: None,
        duration_ms: 1200,
        app: AppInfo {
            version: "8.4.13".to_string(),
            os: "linux".to_string(),
            arch: "x86_64".to_string(),
            install: "deb".to_string(),
        },
        verdict: Verdict::Ok,
        hint: Hint::None,
        remote: Remote::Unknown,
        internet: Internet::Unknown,
        targets: Vec::new(),
        doh: Vec::new(),
        env: None,
        edge: EdgeSnapshot::default(),
        recent: Vec::new(),
        addrs: Vec::new(),
        volume: None,
        relay_volume: Vec::new(),
    }
}

fn ip(text: &str) -> IpAddr {
    text.parse().unwrap()
}

fn reset_target(id: TargetId, node: Option<&str>, host: &str) -> TargetCheck {
    let answer = DnsAnswer {
        addrs: vec![ip("188.165.221.195")],
        ms: Some(4),
        fail: None,
        provider: None,
    };
    TargetCheck {
        id,
        node: node.map(str::to_string),
        host: host.to_string(),
        proxied: false,
        system: answer.clone(),
        doh: Some(DnsAnswer {
            provider: Some("cloudflare".to_string()),
            ..answer
        }),
        dns: DnsState::Sane,
        probe: Some(PhaseProbe {
            addr: Some(ip("188.165.221.195")),
            dns_ms: Some(4),
            tcp_ms: Some(31),
            fail: Some(Fail {
                kind: FailKind::Reset,
                phase: Some(Phase::Tls),
                after_ms: Some(12),
                detail: None,
            }),
            tcp_timestamps: Some(false),
            ..PhaseProbe::default()
        }),
        doh_probe: None,
        app: Some(AppProbe {
            ok: false,
            status: None,
            ms: Some(15),
            fail: Some(Fail::of(FailKind::Reset)),
        }),
        ok: false,
        cells: [Tone::Ok, Tone::Ok, Tone::Fail, Tone::Skip],
        total_ms: None,
    }
}

pub fn troubled() -> NetReport {
    let mut report = sample(1_790_000_000_000);
    report.trigger = Trigger::Auto;
    report.reason = Some("edge-pin".to_string());
    report.verdict = Verdict::Reset;
    report.hint = Hint::ZapretTimestamps;
    report.remote = Remote::Up;
    report.internet = Internet::Online;
    report.targets = vec![
        reset_target(TargetId::Main, None, "api.scnative.space"),
        reset_target(TargetId::Star, None, "api-star.scnative.space"),
        reset_target(TargetId::Storage, None, "storage.scnative.space"),
        reset_target(TargetId::Images, None, "images.scnative.space"),
        reset_target(TargetId::Relay, Some("r1"), "api.r1.relay.scnative.space"),
        reset_target(TargetId::Relay, Some("r2"), "api.r2.relay.scnative.space"),
        reset_target(TargetId::Relay, Some("r3"), "api.r3.relay.scnative.space"),
        reset_target(TargetId::Relay, Some("r4"), "api.r4.relay.scnative.space"),
    ];
    report.doh = ["cloudflare", "google", "quad9", "adguard", "yandex"]
        .into_iter()
        .map(|provider| DohProbe {
            provider: provider.to_string(),
            ok: true,
            ms: Some(40),
            fail: None,
        })
        .collect();
    report.env = Some(EnvInfo {
        dpi: vec![DpiTool {
            name: "winws".to_string(),
            args: None,
        }],
        services: vec![ServiceInfo {
            name: "zapret".to_string(),
            image: Some(format!(
                "\"~\\zapret\\bin\\winws.exe\" --wf-tcp=80,443 {}",
                "--dpi-desync=fake --dpi-desync-fooling=ts ".repeat(40)
            )),
            strategy: Some("general (ALT13)".to_string()),
            start: Some(2),
        }],
        tcp_timestamps: Some("disabled".to_string()),
        dns_servers: vec![ip("192.168.1.1")],
        ..EnvInfo::default()
    });
    report.edge = EdgeSnapshot {
        pins: vec![("api.scnative.space".to_string(), 480_000)],
        pool: vec!["r1".to_string(), "r2".to_string()],
    };
    report.recent = (0..40)
        .map(|at| PathEvent {
            at_ms: report.at_ms - at * 1000,
            origin: "api.scnative.space".to_string(),
            tier: Tier::Direct,
            role: Role::Primary,
            ok: false,
            status: None,
            fail: Some(FailKind::Reset),
            ms: Some(12),
            source: "api".to_string(),
        })
        .collect();
    report
}
