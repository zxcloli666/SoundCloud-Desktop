use super::{failure, lines, name, speed, volume_trouble, why};
use crate::network::fail::{Fail, FailKind, Phase};
use crate::network::netcheck::fixture::sample;
use crate::network::netcheck::model::{
    AppProbe, DnsState, EdgeSnapshot, PhaseProbe, RelayRoute, ServiceRoute, TargetCheck, TargetId,
    UpstreamState, VolumeProbe,
};
use crate::network::netcheck::route::SERVICES;

fn served(ok: bool) -> AppProbe {
    AppProbe {
        ok,
        status: Some(if ok { 200 } else { 502 }),
        ms: Some(120),
        fail: None,
    }
}

fn volume(speed: u64) -> VolumeProbe {
    VolumeProbe {
        host: "storage.r1.relay.scnative.dev".to_string(),
        shape: "clear".to_string(),
        bytes: 512 * 1024,
        ms: 1_300,
        cut: false,
        speed,
    }
}

fn relay(node: &str, speed: u64) -> TargetCheck {
    let mut check = TargetCheck::pending(
        TargetId::Relay,
        Some(node.to_string()),
        format!("{node}.relay.scnative.dev"),
    );
    check.ok = true;
    check.dns = DnsState::Sane;
    check.total_ms = Some(240);
    check.volume = Some(volume(speed));
    check.route = Some(RelayRoute {
        services: SERVICES
            .iter()
            .map(|service| ServiceRoute {
                service: service.label.to_string(),
                state: UpstreamState::Ok,
                probe: served(true),
            })
            .collect(),
        upstreams: Vec::new(),
    });
    check
}

fn reset(id: TargetId, node: Option<&str>, host: &str) -> TargetCheck {
    let mut check = TargetCheck::pending(id, node.map(str::to_string), host.to_string());
    check.dns = DnsState::Sane;
    check.probe = Some(PhaseProbe {
        tcp_ms: Some(30),
        fail: Some(Fail {
            kind: FailKind::Reset,
            phase: Some(Phase::Tls),
            after_ms: Some(12),
            detail: None,
        }),
        ..PhaseProbe::default()
    });
    check
}

#[test]
fn a_failure_is_told_in_words_with_its_likely_cause() {
    let dpi = Fail {
        kind: FailKind::Reset,
        phase: Some(Phase::Tls),
        after_ms: Some(12),
        detail: None,
    };
    assert_eq!(failure(&dpi), "tls reset after 12 ms, looks like DPI");
    let slow = Fail {
        kind: FailKind::Timeout,
        phase: Some(Phase::Tcp),
        after_ms: Some(5_000),
        detail: None,
    };
    assert_eq!(failure(&slow), "tcp timeout after 5000 ms");
    let swapped = Fail::of(FailKind::TlsCert);
    assert_eq!(
        failure(&swapped),
        "foreign certificate, antivirus or proxy swaps the certificate"
    );
}

#[test]
fn a_failed_target_says_why_and_a_working_one_does_not() {
    assert_eq!(why(&relay("r1", 0)), None);
    let broken = reset(TargetId::Relay, Some("r2"), "r2.relay.scnative.dev");
    assert_eq!(
        why(&broken).as_deref(),
        Some("tls reset after 12 ms, looks like DPI")
    );
    let mut lost = TargetCheck::pending(TargetId::Relay, None, "r3.relay.scnative.dev".into());
    lost.dns = DnsState::Failed;
    lost.app = Some(AppProbe {
        ok: false,
        status: None,
        ms: Some(40),
        fail: Some(Fail::of(FailKind::Dns)),
    });
    assert_eq!(
        why(&lost).as_deref(),
        Some("dns: no address from the system resolver or DoH; dns failed")
    );
    let mut erroring = relay("r4", 0);
    erroring.ok = false;
    erroring.app = Some(served(false));
    assert_eq!(why(&erroring).as_deref(), Some("http 502"));
    let mut behind = relay("r5", 0);
    behind.ok = false;
    behind.route.as_mut().unwrap().services[0].probe = served(false);
    assert_eq!(
        why(&behind).as_deref(),
        Some("the relay answers, the api behind it: http 502")
    );
}

#[test]
fn speeds_read_like_a_person_would_say_them() {
    assert_eq!(speed(420 * 1024), "420 KB/s");
    assert_eq!(speed(1_153_434), "1.1 MB/s");
    assert_eq!(speed(0), "0 KB/s");
}

#[test]
fn a_cut_download_is_called_what_it_looks_like() {
    let cut = VolumeProbe {
        shape: "blackhole".to_string(),
        bytes: 13 * 1024,
        cut: true,
        speed: 0,
        ..volume(0)
    };
    assert_eq!(
        volume_trouble(&cut).as_deref(),
        Some("stalls after 13 KB, looks like DPI")
    );
    assert_eq!(volume_trouble(&volume(400_000)), None);
    let slow = VolumeProbe {
        shape: "slow".to_string(),
        speed: 30 * 1024,
        ..volume(0)
    };
    assert_eq!(volume_trouble(&slow).as_deref(), Some("slow, 30 KB/s"));
}

#[test]
fn every_target_kind_has_a_short_name() {
    assert_eq!(name(&relay("r1", 0)), "relay r1");
    let images = TargetCheck::pending(TargetId::Images, None, "images.scnative.dev".into());
    assert_eq!(name(&images), "images direct");
    let pro = TargetCheck::pending(
        TargetId::Pro,
        Some("p1".into()),
        "p1.pro.scnative.dev".into(),
    );
    assert_eq!(name(&pro), "pro p1");
    let call = TargetCheck::pending(
        TargetId::Call,
        Some("call-1".into()),
        "call-1.scnative.dev".into(),
    );
    assert_eq!(name(&call), "call call-1");
}

#[test]
fn the_summary_says_what_works_what_fails_and_what_the_app_uses() {
    let mut report = sample(1);
    let mut slow_s3 = relay("r2", 1_200_000);
    slow_s3.route.as_mut().unwrap().services[4].probe = served(false);
    report.targets = vec![
        relay("r1", 400 * 1024),
        slow_s3,
        reset(TargetId::Relay, Some("r3"), "r3.relay.scnative.dev"),
        reset(TargetId::SoundCloud, None, "api-v2.soundcloud.com"),
    ];
    report.edge = EdgeSnapshot {
        pins: vec![("images".to_string(), 300_000)],
        pool: vec!["r1".to_string(), "r2".to_string(), "r3".to_string()],
        pro: vec!["api".to_string()],
    };
    report.call = Some("active".to_string());
    let summary = lines(&report);
    assert_eq!(summary[0], "works: relay r1 400 KB/s · relay r2 1.1 MB/s");
    assert_eq!(
        summary[1],
        "fails: s3 via r2: http 502 · relay r3: tls reset after 12 ms, looks like DPI · \
         soundcloud direct: tls reset after 12 ms, looks like DPI"
    );
    assert_eq!(
        summary[2],
        "reachable: api r1,r2 · api-star r1,r2 · stream r1,r2 · storage r1,r2 · s3 r1"
    );
    assert_eq!(
        summary[3],
        "app: relays r1,r2,r3 (r1 first) · fastest r2 1.1 MB/s · images via relays · pro for api · call active"
    );
}

#[test]
fn a_service_no_route_reaches_is_shouted() {
    let mut report = sample(1);
    let mut relay = relay("r1", 0);
    relay.route.as_mut().unwrap().services[1].probe = served(false);
    report.targets = vec![relay];
    let summary = lines(&report);
    assert!(summary[2].contains("api-star NONE"), "{}", summary[2]);
    assert!(summary[0].ends_with("relay r1 240 ms"), "{}", summary[0]);
}
