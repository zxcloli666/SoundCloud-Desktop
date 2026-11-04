use sc_chat::{
    ConversationKind, MemberState, MessageBody, NotifyLevel, NotifyPrefs, PreviewMode, SystemKind,
};

use super::super::rules::{Reason, allowed, expired, preview, reason};
use super::fixtures::{ANN, ME, NOW, chat, group, message, system, text};

const HOUR: i64 = 3_600_000;

#[test]
fn own_local_and_deleted_messages_never_notify() {
    let mut mine = text(1, "hi");
    mine.mine = true;
    let mut local = text(2, "hi");
    local.local_only = true;
    assert_eq!(reason(&mine, ME), None);
    assert_eq!(reason(&local, ME), None);
    assert_eq!(reason(&message(3, MessageBody::Deleted), ME), None);
}

#[test]
fn posts_mentions_and_events_about_me_get_a_reason() {
    let mut mention = text(2, "@me look");
    mention.mentions_me = true;
    assert_eq!(reason(&text(1, "hi"), ME), Some(Reason::Post));
    assert_eq!(reason(&mention, ME), Some(Reason::Mention));
    for kind in [
        SystemKind::Kicked,
        SystemKind::Removed,
        SystemKind::Banned,
        SystemKind::Muted,
        SystemKind::Handoff,
    ] {
        assert_eq!(
            reason(&system(3, kind, ME), ME),
            Some(Reason::Personal(kind))
        );
        assert_eq!(reason(&system(3, kind, ANN), ME), None);
    }
    assert_eq!(reason(&system(4, SystemKind::Joined, ME), ME), None);
    assert_eq!(reason(&system(5, SystemKind::Ttl, ME), ME), None);
}

#[test]
fn a_plain_chat_notifies_every_post() {
    assert!(allowed(Reason::Post, &chat(ConversationKind::Direct), NOW));
    assert!(allowed(Reason::Post, &group("Band"), NOW));
}

#[test]
fn a_muted_chat_lets_only_mentions_and_events_about_me_through() {
    let mut muted = group("Band");
    muted.muted_until = Some(NOW + HOUR);
    assert!(!allowed(Reason::Post, &muted, NOW));
    assert!(allowed(Reason::Mention, &muted, NOW));
    assert!(allowed(Reason::Personal(SystemKind::Kicked), &muted, NOW));
}

#[test]
fn a_mute_that_ran_out_is_not_a_mute() {
    let mut was_muted = group("Band");
    was_muted.muted_until = Some(NOW - HOUR);
    assert!(allowed(Reason::Post, &was_muted, NOW));
}

#[test]
fn muted_forever_or_notify_none_silences_mentions_too() {
    let mut forever = group("Band");
    forever.muted_until = Some(i64::MAX);
    let mut none = group("Band");
    none.notify = NotifyLevel::None;
    for silent in [forever, none] {
        assert!(!allowed(Reason::Post, &silent, NOW));
        assert!(!allowed(Reason::Mention, &silent, NOW));
        assert!(allowed(Reason::Personal(SystemKind::Banned), &silent, NOW));
    }
}

#[test]
fn mentions_only_level_drops_plain_posts() {
    let mut mentions = group("Band");
    mentions.notify = NotifyLevel::Mentions;
    assert!(!allowed(Reason::Post, &mentions, NOW));
    assert!(allowed(Reason::Mention, &mentions, NOW));
}

#[test]
fn room_chat_is_silent_except_mentions_and_events_about_me() {
    let room = chat(ConversationKind::Room);
    assert!(!allowed(Reason::Post, &room, NOW));
    assert!(allowed(Reason::Mention, &room, NOW));
    assert!(allowed(Reason::Personal(SystemKind::Handoff), &room, NOW));
    assert!(allowed(Reason::Personal(SystemKind::Muted), &room, NOW));
}

#[test]
fn requests_stay_silent_even_for_mentions() {
    let mut stranger = chat(ConversationKind::Direct);
    stranger.accepted = false;
    let mut invite = group("Band");
    invite.state = MemberState::Invited;
    for request in [stranger, invite] {
        assert!(!allowed(Reason::Post, &request, NOW));
        assert!(!allowed(Reason::Mention, &request, NOW));
    }
}

#[test]
fn saved_and_left_chats_stay_silent_but_a_kick_still_shows() {
    let saved = chat(ConversationKind::Saved);
    let mut kicked = chat(ConversationKind::Room);
    kicked.state = MemberState::Kicked;
    assert!(!allowed(Reason::Post, &saved, NOW));
    assert!(!allowed(Reason::Mention, &kicked, NOW));
    assert!(allowed(Reason::Personal(SystemKind::Kicked), &kicked, NOW));
}

#[test]
fn a_message_is_expired_from_its_expiry_on() {
    let mut expiring = text(1, "bye");
    expiring.expires_at = Some(NOW);
    assert!(expired(&expiring, NOW));
    assert!(!expired(&expiring, NOW - 1));
    assert!(!expired(&text(2, "stays"), NOW));
}

#[test]
fn stream_mode_cuts_a_full_preview_to_the_name() {
    let full = NotifyPrefs::default();
    let hidden = NotifyPrefs {
        preview: PreviewMode::Hidden,
        ..NotifyPrefs::default()
    };
    assert_eq!(preview(&full, false), PreviewMode::Full);
    assert_eq!(preview(&full, true), PreviewMode::NameOnly);
    assert_eq!(preview(&hidden, true), PreviewMode::Hidden);
}
