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
