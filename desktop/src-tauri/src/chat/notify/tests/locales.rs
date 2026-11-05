use std::collections::BTreeSet;

use serde_json::Value;

use super::super::settings::{AppSettings, parse};
use super::super::strings::{LOCALES, Strings, get};

fn keys(raw: &str) -> BTreeSet<String> {
    match serde_json::from_str::<Value>(raw) {
        Ok(Value::Object(map)) => map.keys().cloned().collect(),
        _ => BTreeSet::new(),
    }
}

#[test]
fn every_locale_has_every_string() {
    let english = keys(LOCALES[0].1);
    assert!(!english.is_empty());
    for (code, raw) in LOCALES {
        assert!(serde_json::from_str::<Strings>(raw).is_ok(), "{code}");
        assert_eq!(keys(raw), english, "{code}");
        let Ok(Value::Object(map)) = serde_json::from_str::<Value>(raw) else {
            panic!("{code} is not an object");
        };
        for (key, value) in map {
            assert!(
                value.as_str().is_some_and(|text| !text.trim().is_empty()),
                "{code}.{key}"
            );
        }
    }
}

#[test]
fn templates_keep_their_placeholders() {
    for (code, _) in LOCALES {
        let strings = get(code);
        for template in [&strings.track, &strings.playlist, &strings.profile] {
            assert!(template.contains("{{title}}"), "{code}: {template}");
        }
        assert!(strings.device_body.contains("{{device}}"), "{code}");
    }
}

#[test]
fn the_language_follows_the_app_setting() {
    assert_eq!(get("ru").new_message, "Новое сообщение");
    assert_eq!(get("ru-RU").new_message, "Новое сообщение");
    assert_eq!(get("ko").new_message, "새 메시지");
    assert_eq!(get("de").new_message, "New message");
    assert_eq!(get("").new_message, "New message");
}

#[test]
fn settings_give_the_language_and_the_obs_switch() {
    let raw = br#"{"state":{"language":"tr","obsEnabled":true,"perfMode":"light"},"version":3}"#;
    assert_eq!(
        parse(raw),
        AppSettings {
            language: "tr".to_owned(),
            obs_enabled: true,
        }
    );
    assert_eq!(parse(b"not json"), AppSettings::default());
    assert_eq!(parse(br#"{"version":3}"#), AppSettings::default());
}
