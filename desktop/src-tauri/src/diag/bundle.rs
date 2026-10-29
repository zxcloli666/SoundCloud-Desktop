use std::path::PathBuf;

use backend_contracts::diag::{
    App, Attempt as WireAttempt, BUNDLE_KIND, BUNDLE_VERSION, Bundle, ErrorKind, MAX_BUNDLE_BYTES,
    MAX_ERROR_CHARS, MAX_LOG_LINE_CHARS, MAX_LOG_LINES, MAX_NETCHECK_CHARS, MAX_PATH_CHARS,
    Session, Trigger, TriggerKind,
};
use chrono::{TimeZone, Utc};

use super::attempt::Attempt;
use super::caps;
use super::errors::{ErrorEntry, now_iso};
use crate::app::log_sink::redact;

const LOG_READ_BYTES: u64 = 1024 * 1024;
const DROP_STEP: usize = 10;

pub struct Inputs {
    pub app: App,
    pub session: Session,
    pub trigger: TriggerKind,
    pub netcheck: Option<String>,
    pub log_path: Option<PathBuf>,
}

fn iso(at_ms: u64) -> String {
    Utc.timestamp_millis_opt(at_ms as i64)
        .single()
        .map_or_else(now_iso, |at| {
            at.format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
        })
}

fn attempt_json(attempt: Attempt) -> WireAttempt {
    WireAttempt {
        at: iso(attempt.at_ms),
        trace: attempt.trace,
        span: attempt.span,
        debug: attempt.debug,
        service: attempt.service,
        method: attempt.method,
        path: caps::cut(&redact(&attempt.path), MAX_PATH_CHARS),
        hop: attempt.hop,
        status: attempt.status,
        ms: attempt.ms.into(),
        error: attempt
            .error
            .map(|error| caps::cut(&redact(&error), MAX_ERROR_CHARS)),
        bytes: attempt.bytes,
    }
}

fn log_tail(path: &PathBuf) -> Vec<String> {
    use std::io::{Read, Seek, SeekFrom};
    let Ok(mut file) = std::fs::File::open(path) else {
        return Vec::new();
    };
    let size = file.metadata().map_or(0, |meta| meta.len());
    let _ = file.seek(SeekFrom::Start(size.saturating_sub(LOG_READ_BYTES)));
    let mut bytes = Vec::new();
    let _ = file.read_to_end(&mut bytes);
    let text = String::from_utf8_lossy(&bytes);
    let mut lines: Vec<String> = text
        .lines()
        .filter(|line| {
            line.contains("[WARN]")
                || line.contains("[ERROR]")
                || line.contains("[PANIC]")
                || line.contains("SESSION STARTED")
                || line.contains("SoundCloud Desktop ")
        })
        .map(|line| caps::cut(&redact(line), MAX_LOG_LINE_CHARS))
        .collect();
    let extra = lines.len().saturating_sub(MAX_LOG_LINES);
    lines.drain(..extra);
    lines
}

pub fn build(inputs: Inputs, attempts: Vec<Attempt>, errors: Vec<ErrorEntry>) -> Vec<u8> {
    let error = (inputs.trigger == TriggerKind::Render)
        .then(|| {
            errors
                .iter()
                .rposition(|entry| entry.kind == ErrorKind::Render)
        })
        .flatten()
        .map(|index| index as u32);
    let mut bundle = Bundle {
        kind: BUNDLE_KIND.to_string(),
        v: BUNDLE_VERSION,
        at: now_iso(),
        app: inputs.app,
        session: inputs.session,
        trigger: Trigger {
            kind: inputs.trigger,
            error,
        },
        attempts: attempts.into_iter().map(attempt_json).collect(),
        errors,
        netcheck: inputs
            .netcheck
            .map(|text| caps::cut(&redact(&text), MAX_NETCHECK_CHARS)),
        log_tail: inputs.log_path.as_ref().map(log_tail).unwrap_or_default(),
    };
    loop {
        let bytes = serde_json::to_vec(&bundle).unwrap_or_default();
        if bytes.len() <= MAX_BUNDLE_BYTES {
            return bytes;
        }
        if !bundle.attempts.is_empty() {
            let step = DROP_STEP.min(bundle.attempts.len());
            bundle.attempts.drain(..step);
        } else if !bundle.log_tail.is_empty() {
            let step = DROP_STEP.min(bundle.log_tail.len());
            bundle.log_tail.drain(..step);
        } else {
            return bytes;
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use backend_contracts::diag::{EventsBody, Service};
    use serde_json::Value;

    use super::*;
    use crate::diag::errors::{ErrorInput, entry_of};
    use crate::network::edge::Tier;
    use crate::network::netcheck::model::Role;

    fn inputs() -> Inputs {
        Inputs {
            app: App {
                version: "8.6.1".into(),
                os: "macos".into(),
                os_version: "15.0".into(),
                arch: "aarch64".into(),
                install: "dmg".into(),
                locale: "ru".into(),
                id: "a1b2c3d4e5f6".into(),
            },
            session: Session {
                uptime_s: 5,
                logged_in: true,
                premium: false,
                quality: "hq".into(),
                route: BTreeMap::from([
                    ("main".to_string(), "relay:r2".to_string()),
                    ("star".to_string(), "direct".to_string()),
                ]),
            },
            trigger: TriggerKind::Render,
            netcheck: Some("net text".into()),
            log_path: None,
        }
    }

    fn attempt(error_len: usize) -> Attempt {
        Attempt {
            at_ms: 1_700_000_000_000,
            trace: format!("{}{}", "1".repeat(16), "2".repeat(16)),
            span: "3".repeat(16),
            debug: true,
            service: Service::Stream,
            method: "GET".into(),
            path: "/stream/soundcloud:tracks:123?quality=hq&session_id=secret99".into(),
            hop: "r2".into(),
            origin: "stream.scnative.dev".into(),
            tier: Tier::Relay,
            role: Role::Primary,
            source: "api",
            status: 0,
            ms: 10012,
            error: Some("x".repeat(error_len)),
            fail: None,
            bytes: 0,
        }
    }

    fn render_error() -> ErrorEntry {
        entry_of(ErrorInput {
            kind: ErrorKind::Render,
            message: "bad Bearer abcdefghijk".into(),
            stack: Some("Error: boom\n    at a (http://x/assets/index-Ab12.js:1:2)".into()),
            component_stack: Some("c".repeat(5000)),
            trace: None,
            context: BTreeMap::from([("route".to_string(), "/library".to_string())]),
        })
    }

    #[test]
    fn the_bundle_has_the_documented_shape() {
        let bytes = build(inputs(), vec![attempt(10)], vec![render_error()]);
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["kind"], "scd-diagnostics");
        assert_eq!(json["v"], 1);
        assert_eq!(json["app"]["id"], "a1b2c3d4e5f6");
        assert_eq!(json["session"]["route"]["main"], "relay:r2");
        assert_eq!(json["trigger"]["kind"], "render");
        assert_eq!(json["trigger"]["error"], 0);
        assert_eq!(json["netcheck"], "net text");
        assert_eq!(json["errors"][0]["context"]["route"], "/library");
        let first = &json["attempts"][0];
        assert_eq!(
            first["trace"],
            format!("{}{}", "1".repeat(16), "2".repeat(16))
        );
        assert_eq!(first["span"].as_str().unwrap().len(), 16);
        assert_eq!(first["service"], "stream");
        assert_eq!(first["hop"], "r2");
        assert!(first["at"].as_str().unwrap().ends_with('Z'));
        assert!(json["log_tail"].as_array().unwrap().is_empty());
    }

    #[test]
    fn secrets_are_redacted() {
        let text =
            String::from_utf8(build(inputs(), vec![attempt(10)], vec![render_error()])).unwrap();
        assert!(!text.contains("secret99"));
        assert!(text.contains("session_id=***"));
        assert!(!text.contains("abcdefghijk"));
        assert!(text.contains("tracks:123"));
    }

    #[test]
    fn the_cap_drops_the_oldest_attempts_first() {
        let attempts: Vec<Attempt> = (0..300)
            .map(|index| {
                let mut each = attempt(2000);
                each.status = index;
                each
            })
            .collect();
        let bytes = build(inputs(), attempts, vec![render_error()]);
        assert!(bytes.len() <= MAX_BUNDLE_BYTES);
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        let kept = json["attempts"].as_array().unwrap();
        assert!(!kept.is_empty() && kept.len() < 300);
        assert_eq!(kept.last().unwrap()["status"], 299);
        assert_eq!(json["errors"].as_array().unwrap().len(), 1);
    }

    #[test]
    fn the_log_tail_keeps_warnings_and_headers() {
        let dir = std::env::temp_dir().join(format!("scd-tail-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("desktop.log");
        let mut lines = vec!["[t] [INFO] SoundCloud Desktop 8.6.1 on macos aarch64".to_string()];
        for number in 0..200 {
            lines.push(format!("[t] [INFO] noise {number}"));
            lines.push(format!("[t] [WARN] problem {number} ?token=abc123"));
        }
        std::fs::write(&path, lines.join("\n")).unwrap();
        let tail = log_tail(&path);
        assert_eq!(tail.len(), MAX_LOG_LINES);
        assert!(tail.iter().all(|line| line.contains("[WARN]")));
        assert!(tail.last().unwrap().contains("problem 199"));
        assert!(tail.iter().all(|line| !line.contains("abc123")));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn parsed(bytes: &[u8]) -> Bundle {
        serde_json::from_slice(bytes).unwrap()
    }

    #[test]
    fn a_full_bundle_passes_the_contract_check() {
        let dir = std::env::temp_dir().join(format!("scd-check-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("desktop.log");
        let lines: Vec<String> = (0..400)
            .map(|number| format!("[t] [WARN] {} {number}", "w".repeat(700)))
            .collect();
        std::fs::write(&path, lines.join("\n")).unwrap();
        let mut full = inputs();
        full.log_path = Some(path);
        full.netcheck = Some("n".repeat(20_000));
        let attempts: Vec<Attempt> = (0..300).map(|_| attempt(5000)).collect();
        let errors: Vec<ErrorEntry> = (0..50)
            .map(|number| {
                let mut each = render_error();
                each.message = "m".repeat(number + 1);
                each.recompute_fingerprint();
                each
            })
            .collect();
        let bytes = build(full, attempts, errors);
        std::fs::remove_dir_all(&dir).unwrap();
        let bundle = parsed(&bytes);
        assert_eq!(bundle.check(), Ok(()));
        assert!(bytes.len() <= MAX_BUNDLE_BYTES);
        assert_eq!(bundle.errors.len(), 50);
        assert_eq!(
            bundle.log_tail.len().min(MAX_LOG_LINES),
            bundle.log_tail.len()
        );
        assert_eq!(bundle.trigger.error, Some(49));
    }

    #[test]
    fn the_small_bundle_passes_the_contract_check() {
        let bytes = build(inputs(), vec![attempt(10)], vec![render_error()]);
        assert_eq!(parsed(&bytes).check(), Ok(()));
    }

    #[test]
    fn events_pass_the_contract_check() {
        let body = EventsBody {
            app: inputs().app,
            events: vec![render_error()],
        };
        assert_eq!(body.check(), Ok(()));
        let sent: EventsBody =
            serde_json::from_value(serde_json::to_value(&body).unwrap()).unwrap();
        assert_eq!(sent.events[0].fingerprint, body.events[0].fingerprint);
    }

    #[test]
    fn every_hop_label_passes_the_contract_check() {
        let hosts = [
            ("api.scnative.dev", Tier::Direct),
            ("stream.r2.relay.scnative.dev", Tier::Relay),
            ("r2.relay.scnative.dev", Tier::Relay),
            ("stream.relay.scnative.dev", Tier::Relay),
            ("p1.pro.scnative.dev", Tier::Pro),
            ("pro.scnative.dev", Tier::Pro),
        ];
        for (host, tier) in hosts {
            let mut each = attempt(1);
            each.hop = crate::diag::attempt::hop_label(host, tier);
            let bytes = build(inputs(), vec![each], vec![]);
            assert_eq!(parsed(&bytes).check(), Ok(()), "{host}");
        }
    }
}
