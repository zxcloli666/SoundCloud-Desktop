use std::collections::BTreeMap;
use std::net::IpAddr;

use super::{cells, dns_state, hint, verdict};
use crate::network::fail::{Fail, FailKind, Phase};
use crate::network::netcheck::model::{
    AppProbe, DnsAnswer, DnsState, DpiTool, EnvInfo, Hint, Internet, PhaseProbe, Remote,
    ServiceInfo, TargetCheck, TargetId, Tone, Verdict, ZapretConfig,
};

fn ip(text: &str) -> IpAddr {
    text.parse().unwrap()
}

fn answer(addrs: &[&str]) -> DnsAnswer {
    DnsAnswer {
        addrs: addrs.iter().map(|text| ip(text)).collect(),
        ms: Some(5),
        fail: None,
        provider: None,
    }
}

fn passed_probe() -> PhaseProbe {
    PhaseProbe {
        addr: Some(ip("188.165.221.195")),
        dns_ms: Some(5),
        tcp_ms: Some(30),
        tls_ms: Some(40),
        first_byte_ms: Some(50),
        status: Some(200),
        ..PhaseProbe::default()
    }
}

fn fail(kind: FailKind, phase: Phase) -> Fail {
    Fail {
        kind,
        phase: Some(phase),
        after_ms: Some(12),
        detail: None,
    }
}

fn failed_probe(kind: FailKind, phase: Phase) -> PhaseProbe {
    let mut probe = passed_probe();
    probe.first_byte_ms = None;
    probe.status = None;
    if phase != Phase::FirstByte {
        probe.tls_ms = None;
    }
    if phase == Phase::Tcp {
        probe.tcp_ms = None;
    }
    probe.fail = Some(fail(kind, phase));
    probe
}

fn healthy(id: TargetId) -> TargetCheck {
    let mut check = TargetCheck::pending(id, None, format!("{}.scnative.space", id.as_str()));
    check.system = answer(&["188.165.221.195"]);
    check.dns = DnsState::Sane;
    check.probe = Some(passed_probe());
    check.app = Some(AppProbe {
        ok: true,
        status: Some(200),
        ms: Some(80),
        fail: None,
    });
    check.ok = true;
    check
}

fn broken(id: TargetId, kind: FailKind, phase: Phase) -> TargetCheck {
    let mut check = healthy(id);
    check.probe = Some(failed_probe(kind, phase));
    check.app = Some(AppProbe {
        ok: false,
        status: None,
        ms: None,
        fail: Some(Fail::of(kind)),
    });
    check.ok = false;
    check
}

fn all_broken(kind: FailKind, phase: Phase) -> Vec<TargetCheck> {
    [
        TargetId::Main,
        TargetId::Star,
        TargetId::Storage,
        TargetId::Images,
        TargetId::Relay,
    ]
    .into_iter()
    .map(|id| broken(id, kind, phase))
    .collect()
}

fn judge(targets: &[TargetCheck]) -> Verdict {
    verdict(targets, Internet::Unknown, Remote::Unknown)
}

#[test]
fn every_target_answering_is_ok() {
    let targets = vec![healthy(TargetId::Main), healthy(TargetId::Relay)];
    assert_eq!(
        verdict(&targets, Internet::Offline, Remote::Down),
        Verdict::Ok
    );
}

#[test]
fn no_internet_beats_everything_but_ok() {
    let mut targets = all_broken(FailKind::Dns, Phase::Dns);
    targets[0].dns = DnsState::Garbage;
    assert_eq!(
        verdict(&targets, Internet::Offline, Remote::Down),
        Verdict::Offline
    );
}

#[test]
fn a_garbage_dns_answer_is_dns() {
    let mut targets = all_broken(FailKind::Reset, Phase::Tls);
    targets[2].dns = DnsState::Garbage;
    assert_eq!(judge(&targets), Verdict::Dns);
}

#[test]
fn a_wrong_answer_the_app_works_around_is_still_dns() {
    let mut targets = vec![healthy(TargetId::Main), healthy(TargetId::Storage)];
    targets[1].system = answer(&["2.26.93.81"]);
    targets[1].dns = DnsState::Garbage;
    assert_eq!(judge(&targets), Verdict::Dns);
    targets[1].dns = DnsState::Spoofed;
    assert_eq!(judge(&targets), Verdict::Dns);
}

#[test]
fn a_missing_name_the_app_works_around_is_still_dns() {
    let mut targets = vec![healthy(TargetId::Main)];
    targets[0].system = DnsAnswer {
        fail: Some(Fail::of(FailKind::Dns)),
        ..DnsAnswer::default()
    };
    targets[0].dns = DnsState::Garbage;
    assert_eq!(judge(&targets), Verdict::Dns);
}

#[test]
fn a_slow_system_resolver_alone_is_not_a_wrong_answer() {
    let mut targets = vec![healthy(TargetId::Main), healthy(TargetId::Relay)];
    targets[0].system = DnsAnswer {
        fail: Some(Fail::timeout_after(6_000)),
        ..DnsAnswer::default()
    };
    targets[0].dns = DnsState::Garbage;
    assert_eq!(judge(&targets), Verdict::Ok);
}

#[test]
fn a_wrong_answer_beats_backup_routes_being_down() {
    let mut targets = vec![
        healthy(TargetId::Main),
        broken(TargetId::Relay, FailKind::Refused, Phase::Tcp),
    ];
    targets[1].system = answer(&["0.0.0.0"]);
    targets[1].dns = DnsState::Garbage;
    assert_eq!(judge(&targets), Verdict::Dns);
}

#[test]
fn a_spoofed_answer_is_dns() {
    let system = answer(&["5.45.67.89"]);
    let doh = answer(&["188.165.221.195"]);
    assert_eq!(
        dns_state(&system, Some(&doh), Some(false), Some(true)),
        DnsState::Spoofed
    );
    let mut targets = all_broken(FailKind::Timeout, Phase::Tcp);
    targets[0].dns = DnsState::Spoofed;
    assert_eq!(judge(&targets), Verdict::Dns);
}

#[test]
fn disjoint_answers_that_both_fail_are_not_a_dns_problem() {
    let system = answer(&["2.26.99.107"]);
    let doh = answer(&["188.165.221.195"]);
    assert_eq!(
        dns_state(&system, Some(&doh), Some(false), Some(false)),
        DnsState::Sane
    );
    assert_eq!(
        dns_state(&system, Some(&doh), Some(true), None),
        DnsState::Sane
    );
}

#[test]
fn a_fake_ip_tunnel_answer_is_never_spoofed() {
    let system = answer(&["198.18.0.5"]);
    let doh = answer(&["188.165.221.195"]);
    assert_eq!(
        dns_state(&system, Some(&doh), Some(false), Some(true)),
        DnsState::Sane
    );
}

#[test]
fn a_bogus_or_missing_system_answer_is_garbage_only_when_doh_knows_better() {
    let doh = answer(&["188.165.221.195"]);
    assert_eq!(
        dns_state(&answer(&["0.0.0.0"]), Some(&doh), None, None),
        DnsState::Garbage
    );
    assert_eq!(
        dns_state(&answer(&["2.26.93.81"]), Some(&doh), None, None),
        DnsState::Garbage
    );
    let failed = DnsAnswer {
        fail: Some(Fail::of(FailKind::Dns)),
        ..DnsAnswer::default()
    };
    assert_eq!(
        dns_state(&failed, Some(&doh), None, None),
        DnsState::Garbage
    );
    assert_eq!(
        dns_state(&failed, Some(&answer(&[])), None, None),
        DnsState::Failed
    );
    assert_eq!(dns_state(&failed, None, None, None), DnsState::Failed);
}

#[test]
fn names_neither_resolver_finds_are_a_failed_dns() {
    let mut targets = all_broken(FailKind::Dns, Phase::Dns);
    for target in &mut targets {
        target.dns = DnsState::Failed;
    }
    assert_eq!(judge(&targets), Verdict::DnsFailed);
}

#[test]
fn a_foreign_certificate_beats_resets() {
    let mut targets = all_broken(FailKind::Reset, Phase::Tls);
    targets[3].probe = Some(failed_probe(FailKind::TlsCert, Phase::Tls));
    assert_eq!(judge(&targets), Verdict::Cert);
}

#[test]
fn a_status_page_saying_down_is_down() {
    let targets = all_broken(FailKind::Reset, Phase::Tls);
    assert_eq!(
        verdict(&targets, Internet::Online, Remote::Down),
        Verdict::Down
    );
}

#[test]
fn main_up_with_covers_failing_is_partial() {
    let targets = vec![
        healthy(TargetId::Main),
        broken(TargetId::Images, FailKind::Timeout, Phase::Tcp),
    ];
    assert_eq!(judge(&targets), Verdict::Partial);
}

#[test]
fn only_backup_routes_failing_is_backup_down() {
    let targets = vec![
        healthy(TargetId::Main),
        healthy(TargetId::Storage),
        healthy(TargetId::Images),
        broken(TargetId::Relay, FailKind::Timeout, Phase::Tcp),
        healthy(TargetId::Relay),
    ];
    assert_eq!(judge(&targets), Verdict::BackupDown);
}

#[test]
fn a_failing_star_with_backups_down_is_still_partial() {
    let targets = vec![
        healthy(TargetId::Main),
        broken(TargetId::Star, FailKind::Reset, Phase::Tls),
        broken(TargetId::Relay, FailKind::Timeout, Phase::Tcp),
    ];
    assert_eq!(judge(&targets), Verdict::Partial);
}

#[test]
fn main_down_with_a_relay_up_is_relay_only() {
    let targets = vec![
        broken(TargetId::Main, FailKind::Reset, Phase::Tls),
        healthy(TargetId::Relay),
    ];
    assert_eq!(judge(&targets), Verdict::RelayOnly);
}

#[test]
fn resets_everywhere_are_reset() {
    assert_eq!(
        judge(&all_broken(FailKind::Reset, Phase::Tls)),
        Verdict::Reset
    );
    assert_eq!(
        judge(&all_broken(FailKind::Closed, Phase::Tls)),
        Verdict::Reset
    );
}

#[test]
fn a_refused_connection_counts_as_reset() {
    assert_eq!(
        judge(&all_broken(FailKind::Refused, Phase::Tcp)),
        Verdict::Reset
    );
}

#[test]
fn timeouts_everywhere_are_timeout() {
    assert_eq!(
        judge(&all_broken(FailKind::Timeout, Phase::Tcp)),
        Verdict::Timeout
    );
}

#[test]
fn an_unreachable_network_counts_as_timeout() {
    assert_eq!(
        judge(&all_broken(FailKind::Unreachable, Phase::Tcp)),
        Verdict::Timeout
    );
}

#[test]
fn a_tie_goes_to_reset() {
    let targets = vec![
        broken(TargetId::Main, FailKind::Reset, Phase::Tls),
        broken(TargetId::Star, FailKind::Timeout, Phase::Tcp),
    ];
    assert_eq!(judge(&targets), Verdict::Reset);
}

#[test]
fn server_errors_are_down() {
    let mut targets = vec![healthy(TargetId::Main), healthy(TargetId::Star)];
    for target in &mut targets {
        target.ok = false;
        target.app = Some(AppProbe {
            ok: false,
            status: Some(502),
            ms: Some(40),
            fail: None,
        });
    }
    assert_eq!(judge(&targets), Verdict::Down);
}

#[test]
fn an_unclassified_app_failure_uses_the_probe() {
    let mut target = broken(TargetId::Main, FailKind::Reset, Phase::Tls);
    target.app = Some(AppProbe {
        ok: false,
        status: None,
        ms: None,
        fail: Some(Fail::of(FailKind::Other)),
    });
    assert_eq!(judge(&[target]), Verdict::Reset);
}

#[test]
fn nothing_matched_is_unknown() {
    assert_eq!(
        judge(&all_broken(FailKind::Body, Phase::FirstByte)),
        Verdict::Unknown
    );
    assert_eq!(judge(&[]), Verdict::Unknown);
}

fn zapret_env(args: Option<&str>, timestamps: Option<&str>) -> EnvInfo {
    EnvInfo {
        dpi: vec![DpiTool {
            name: "winws".to_string(),
            args: args.map(str::to_string),
        }],
        tcp_timestamps: timestamps.map(str::to_string),
        ..EnvInfo::default()
    }
}

#[test]
fn a_running_winws_hints_zapret() {
    let targets = all_broken(FailKind::Reset, Phase::Tls);
    let env = zapret_env(None, Some("enabled"));
    assert_eq!(hint(Verdict::Reset, Some(&env), &targets), Hint::Zapret);
}

#[test]
fn a_ts_strategy_without_timestamps_hints_turning_them_on() {
    let targets = all_broken(FailKind::Reset, Phase::Tls);
    let env = zapret_env(Some("--dpi-desync-fooling=badseq,ts"), Some("disabled"));
    assert_eq!(
        hint(Verdict::Reset, Some(&env), &targets),
        Hint::ZapretTimestamps
    );
}

#[test]
fn timestamps_windows_only_allows_count_as_off() {
    let targets = all_broken(FailKind::Reset, Phase::Tls);
    for value in ["allowed", "default"] {
        let env = zapret_env(Some("--dpi-desync-fooling=ts"), Some(value));
        assert_eq!(
            hint(Verdict::Reset, Some(&env), &targets),
            Hint::ZapretTimestamps,
            "{value}"
        );
    }
}

#[test]
fn a_ts_strategy_with_timestamps_on_is_plain_zapret() {
    let targets = all_broken(FailKind::Timeout, Phase::Tls);
    let env = zapret_env(Some("--dpi-desync-fooling=ts"), Some("enabled"));
    assert_eq!(hint(Verdict::Timeout, Some(&env), &targets), Hint::Zapret);
}

#[test]
fn a_probe_without_timestamps_counts_as_timestamps_off() {
    let mut targets = all_broken(FailKind::Reset, Phase::Tls);
    if let Some(probe) = targets[0].probe.as_mut() {
        probe.tcp_timestamps = Some(false);
    }
    let env = EnvInfo {
        services: vec![ServiceInfo {
            name: "zapret".to_string(),
            image: Some(
                "\"~\\zapret\\bin\\winws.exe\" --wf-tcp=443 --dpi-desync-fooling=ts".to_string(),
            ),
            strategy: Some("general (ALT13)".to_string()),
            start: Some(2),
        }],
        ..zapret_env(None, None)
    };
    assert_eq!(
        hint(Verdict::RelayOnly, Some(&env), &targets),
        Hint::ZapretTimestamps
    );
}

#[test]
fn a_linux_config_with_tcp_ts_is_a_ts_strategy() {
    let targets = all_broken(FailKind::Reset, Phase::Tls);
    let mut values = BTreeMap::new();
    values.insert(
        "NFQWS2_OPT".to_string(),
        "--lua-desync=fake:blob=x:tcp_ts=-1000".to_string(),
    );
    let env = EnvInfo {
        dpi: vec![DpiTool {
            name: "nfqws2".to_string(),
            args: None,
        }],
        tcp_timestamps: Some("disabled".to_string()),
        zapret_config: Some(ZapretConfig {
            path: "/opt/zapret2/config".to_string(),
            values,
        }),
        ..EnvInfo::default()
    };
    assert_eq!(
        hint(Verdict::Reset, Some(&env), &targets),
        Hint::ZapretTimestamps
    );
}

#[test]
fn without_a_running_dpi_tool_there_is_no_hint() {
    let targets = all_broken(FailKind::Reset, Phase::Tls);
    assert_eq!(
        hint(Verdict::Reset, Some(&EnvInfo::default()), &targets),
        Hint::None
    );
    assert_eq!(hint(Verdict::Reset, None, &targets), Hint::None);
    let disabled = EnvInfo {
        services: vec![ServiceInfo {
            name: "zapret".to_string(),
            start: Some(4),
            ..ServiceInfo::default()
        }],
        ..EnvInfo::default()
    };
    assert_eq!(hint(Verdict::Reset, Some(&disabled), &targets), Hint::None);
    let stopped = EnvInfo {
        services: vec![ServiceInfo {
            name: "zapret".to_string(),
            start: Some(2),
            ..ServiceInfo::default()
        }],
        ..EnvInfo::default()
    };
    assert_eq!(hint(Verdict::Reset, Some(&stopped), &targets), Hint::None);
    let driver_only = EnvInfo {
        services: vec![ServiceInfo {
            name: "WinDivert".to_string(),
            start: Some(3),
            ..ServiceInfo::default()
        }],
        ..EnvInfo::default()
    };
    assert_eq!(
        hint(Verdict::Reset, Some(&driver_only), &targets),
        Hint::None
    );
}

#[test]
fn other_verdicts_get_no_hint() {
    let env = zapret_env(Some("--dpi-desync-fooling=ts"), Some("disabled"));
    for verdict in [
        Verdict::Ok,
        Verdict::Dns,
        Verdict::DnsFailed,
        Verdict::Cert,
        Verdict::Down,
        Verdict::Partial,
    ] {
        assert_eq!(hint(verdict, Some(&env), &[]), Hint::None, "{verdict:?}");
    }
}

#[test]
fn a_healthy_row_is_green() {
    assert_eq!(cells(&healthy(TargetId::Main)), [Tone::Ok; 4]);
}

#[test]
fn a_proxied_row_skips_the_socket_phases() {
    let mut target = healthy(TargetId::Main);
    target.proxied = true;
    target.probe = None;
    assert_eq!(cells(&target), [Tone::Ok, Tone::Skip, Tone::Skip, Tone::Ok]);
    target.app = Some(AppProbe::default());
    assert_eq!(
        cells(&target),
        [Tone::Ok, Tone::Skip, Tone::Skip, Tone::Fail]
    );
}

#[test]
fn a_reset_in_tls_is_red_at_tls() {
    let target = broken(TargetId::Main, FailKind::Reset, Phase::Tls);
    assert_eq!(cells(&target), [Tone::Ok, Tone::Ok, Tone::Fail, Tone::Skip]);
}

#[test]
fn a_foreign_certificate_is_red_at_tls() {
    let target = broken(TargetId::Main, FailKind::TlsCert, Phase::Tls);
    assert_eq!(cells(&target), [Tone::Ok, Tone::Ok, Tone::Fail, Tone::Skip]);
}

#[test]
fn a_stall_after_tls_is_red_at_http() {
    let target = broken(TargetId::Main, FailKind::Timeout, Phase::FirstByte);
    assert_eq!(cells(&target), [Tone::Ok, Tone::Ok, Tone::Ok, Tone::Fail]);
}

#[test]
fn a_garbage_answer_warns_in_the_dns_cell() {
    let mut target = healthy(TargetId::Main);
    target.dns = DnsState::Garbage;
    assert_eq!(cells(&target)[0], Tone::Warn);
    target.dns = DnsState::Failed;
    target.probe = None;
    target.app = Some(AppProbe::default());
    assert_eq!(
        cells(&target),
        [Tone::Fail, Tone::Skip, Tone::Skip, Tone::Fail]
    );
}

#[test]
fn an_unchecked_name_is_skipped_in_the_dns_cell() {
    let mut target = healthy(TargetId::Main);
    target.dns = DnsState::Unchecked;
    target.proxied = true;
    target.probe = None;
    assert_eq!(
        cells(&target),
        [Tone::Skip, Tone::Skip, Tone::Skip, Tone::Ok]
    );
}

#[test]
fn a_probe_that_passed_while_the_app_failed_warns_at_http() {
    let mut target = healthy(TargetId::Main);
    target.app = Some(AppProbe::default());
    assert_eq!(cells(&target)[3], Tone::Warn);
}
