use sc_chat::{NotifyPrefs, PreviewMode};
use uuid::Uuid;

use super::super::markup::escape;
use super::super::prefs_file::{read, write};

#[test]
fn markup_characters_are_escaped() {
    assert_eq!(
        escape(r#"<a href="https://evil.example">pay</a> & <b>go</b>"#),
        "&lt;a href=\"https://evil.example\"&gt;pay&lt;/a&gt; &amp; &lt;b&gt;go&lt;/b&gt;"
    );
    assert_eq!(escape("plain текст"), "plain текст");
}

#[test]
fn prefs_survive_a_restart() {
    let dir = std::env::temp_dir().join(format!("sc-notify-{}", Uuid::new_v4()));
    let path = dir.join("chat").join("notify.json");
    assert_eq!(read(&path), None);
    let prefs = NotifyPrefs {
        enabled: false,
        preview: PreviewMode::Hidden,
        sound: false,
        stream_mode: true,
    };
    write(&path, &prefs);
    assert_eq!(read(&path), Some(prefs));
    std::fs::write(&path, b"{").expect("broken file");
    assert_eq!(read(&path), None);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn prefs_live_in_the_chat_folder_the_app_picked() {
    let dir = std::env::temp_dir().join(format!("sc-notify-{}", Uuid::new_v4()));
    let prefs = NotifyPrefs {
        enabled: true,
        preview: PreviewMode::Hidden,
        sound: false,
        stream_mode: false,
    };
    super::super::Notifier::stored_in(&dir).prefs(Some(prefs));
    assert_eq!(read(&dir.join("notify.json")), Some(prefs));
    assert_eq!(super::super::Notifier::stored_in(&dir).prefs(None), prefs);
    std::fs::remove_dir_all(dir).unwrap();
}
