use sc_chat::{ConversationKind, Embed, EmbedKind, MessageBody, PreviewMode, RichText, SystemKind};

use super::super::alert::{Alert, chat as alert, device};
use super::super::rules::Reason;
use super::super::strings;
use super::fixtures::{ME, NOW, chat, device as new_device, group, message, spoiler, system, text};

fn en() -> &'static strings::Strings {
    strings::get("en")
}

fn track(title: &str) -> Embed {
    Embed {
        kind: EmbedKind::Track,
        urn: "soundcloud:tracks:1".to_owned(),
        permalink: "https://soundcloud.com/a/b".to_owned(),
        secret_token: None,
        title: title.to_owned(),
        artist: Some("Artist".to_owned()),
        artwork_url: None,
        duration_ms: Some(1000),
        access: None,
        at_ms: None,
        tracks: Vec::new(),
        room: None,
    }
}

#[test]
fn a_direct_message_shows_the_peer_and_the_text() {
    let shown = alert(
        &chat(ConversationKind::Direct),
        &text(1, "see you at  8\n tonight"),
        Reason::Post,
        None,
        PreviewMode::Full,
        en(),
    );
    assert_eq!(
        shown,
        Alert {
            title: Some("Ann".to_owned()),
            body: "see you at 8 tonight".to_owned(),
        }
    );
}

#[test]
fn a_group_message_names_the_sender() {
    let shown = alert(
        &group("Band"),
        &text(1, "hi all"),
        Reason::Post,
        Some("Ann"),
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.title.as_deref(), Some("Band"));
    assert_eq!(shown.body, "Ann: hi all");
}

#[test]
fn name_only_and_hidden_never_carry_the_text() {
    let secret = text(1, "my password is hunter2");
    let named = alert(
        &group("Band"),
        &secret,
        Reason::Post,
        Some("Ann"),
        PreviewMode::NameOnly,
        en(),
    );
    let hidden = alert(
        &group("Band"),
        &secret,
        Reason::Mention,
        Some("Ann"),
        PreviewMode::Hidden,
        en(),
    );
    assert_eq!(named.title.as_deref(), Some("Band"));
    assert_eq!(named.body, en().new_message);
    assert_eq!(hidden.title, None);
    assert_eq!(hidden.body, en().new_message);
}

#[test]
fn a_disappearing_message_never_shows_its_text() {
    let mut expiring = text(1, "this goes away");
    expiring.expires_at = Some(NOW + 60_000);
    let shown = alert(
        &chat(ConversationKind::Direct),
        &expiring,
        Reason::Post,
        None,
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.body, en().new_message);
    assert!(!shown.body.contains("goes away"));
}

#[test]
fn spoilers_are_masked() {
    let shown = alert(
        &chat(ConversationKind::Direct),
        &spoiler(1, "the end: he dies", 9, 7),
        Reason::Post,
        None,
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.body, "the end: •••");
}

#[test]
fn spoiler_offsets_count_utf16_units() {
    let shown = alert(
        &chat(ConversationKind::Direct),
        &spoiler(1, "😀 тайна ок", 3, 5),
        Reason::Post,
        None,
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.body, "😀 ••• ок");
}

#[test]
fn a_long_text_is_clipped() {
    let long = "a".repeat(500);
    let shown = alert(
        &chat(ConversationKind::Direct),
        &text(1, &long),
        Reason::Post,
        None,
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.body.chars().count(), 180);
    assert!(shown.body.ends_with('…'));
}

#[test]
fn an_embed_without_text_names_the_card() {
    let mut shared = text(1, "  ");
    shared.embeds.push(track("Night Drive"));
    let shown = alert(
        &chat(ConversationKind::Direct),
        &shared,
        Reason::Post,
        None,
        PreviewMode::Full,
        strings::get("ru"),
    );
    assert_eq!(shown.body, "Трек: Night Drive");
}

#[test]
fn locked_and_unknown_bodies_fall_back_to_new_message() {
    for body in [MessageBody::Locked, MessageBody::Unknown] {
        let shown = alert(
            &chat(ConversationKind::Direct),
            &message(1, body),
            Reason::Post,
            None,
            PreviewMode::Full,
            en(),
        );
        assert_eq!(shown.body, en().new_message);
    }
}

#[test]
fn events_about_me_say_what_happened() {
    let mut room = chat(ConversationKind::Room);
    room.peer = None;
    room.room_code = Some("K7Q2".to_owned());
    let cases = [
        (SystemKind::Kicked, &en().kicked),
        (SystemKind::Banned, &en().banned),
        (SystemKind::Muted, &en().muted),
        (SystemKind::Handoff, &en().host),
        (SystemKind::Removed, &en().removed),
    ];
    for (kind, said) in cases {
        let shown = alert(
            &room,
            &system(1, kind, ME),
            Reason::Personal(kind),
            None,
            PreviewMode::NameOnly,
            en(),
        );
        assert_eq!(shown.title.as_deref(), Some("Room K7Q2"));
        assert_eq!(&shown.body, said);
    }
}

#[test]
fn a_chat_without_a_name_gets_a_kind_title() {
    let mut nameless = group("  ");
    nameless.title = Some("  ".to_owned());
    let shown = alert(
        &nameless,
        &message(
            1,
            MessageBody::Text(RichText {
                text: "x".to_owned(),
                spans: Vec::new(),
            }),
        ),
        Reason::Post,
        None,
        PreviewMode::NameOnly,
        strings::get("ru"),
    );
    assert_eq!(shown.title.as_deref(), Some("Группа"));
}

#[test]
fn a_device_alert_names_the_device() {
    let shown = device(&new_device("MacBook Pro", "macos"), strings::get("ru"));
    assert_eq!(shown.title.as_deref(), Some("Новое устройство в чатах"));
    assert_eq!(shown.body, "MacBook Pro, macos. Это вы?");
}

#[test]
fn an_empty_title_falls_back_to_the_peer_and_names_stay_on_one_line() {
    let mut direct = chat(ConversationKind::Direct);
    direct.title = Some(String::new());
    let shown = alert(
        &direct,
        &text(1, "x"),
        Reason::Post,
        None,
        PreviewMode::NameOnly,
        en(),
    );
    assert_eq!(shown.title.as_deref(), Some("Ann"));
    let shown = alert(
        &group("Late\n  night\tcrew"),
        &text(1, "x"),
        Reason::Post,
        Some(" Ann\nB "),
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.title.as_deref(), Some("Late night crew"));
    assert_eq!(shown.body, "Ann B: x");
}

#[test]
fn control_characters_never_reach_the_notification() {
    let shown = alert(
        &chat(ConversationKind::Direct),
        &text(1, "a\u{0}b\u{7}c\u{1b}[31md"),
        Reason::Post,
        None,
        PreviewMode::Full,
        en(),
    );
    assert_eq!(shown.body, "a b c [31md");
}

#[test]
fn a_device_name_is_one_short_line() {
    let long = "x".repeat(400);
    let shown = device(&new_device(&format!("Rig\n{long}"), "win\u{0}dows"), en());
    assert_eq!(shown.body.chars().count(), 180);
    assert!(!shown.body.chars().any(char::is_control));
    let shown = device(&new_device("Rig", "win\u{0}dows"), en());
    assert_eq!(shown.body, "Rig, win dows. Was it you?");
}
