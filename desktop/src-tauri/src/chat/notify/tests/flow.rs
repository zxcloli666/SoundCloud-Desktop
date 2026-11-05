use std::collections::HashSet;
use std::sync::atomic::Ordering;

use sc_chat::{ConversationKind, SystemKind};
use uuid::Uuid;

use super::super::history::{History, ONE_PER_CHAT_MS, OPEN_WITHIN_MS};
use super::super::rules::Reason;
use super::super::{Notifier, pick};
use super::fixtures::{ANN, ME, NOW, channel_at, chat, system, text};

fn since(notifier: &Notifier) -> i64 {
    notifier.since.load(Ordering::Acquire)
}

fn live(notifier: &Notifier, seq: i64, body: &str) -> sc_chat::Message {
    let mut message = text(seq, body);
    message.ts = since(notifier) + 1_000;
    message
}

#[test]
fn an_expired_message_is_dropped_before_anything_is_shown() {
    let notifier = Notifier::default();
    let now = since(&notifier) + 5_000;
    let mut gone = live(&notifier, 1, "secret");
    gone.expires_at = Some(now - 1);
    let mut later = live(&notifier, 2, "still here");
    later.expires_at = Some(now + 60_000);
    let messages = [gone, later];
    let fresh = notifier.fresh(
        &chat(ConversationKind::Direct),
        &messages,
        ME,
        &HashSet::new(),
        now,
    );
    assert_eq!(fresh.len(), 1);
    assert_eq!(fresh[0].0.seq, Some(2));
}

#[test]
fn read_seen_and_old_messages_do_not_notify() {
    let notifier = Notifier::default();
    let now = since(&notifier) + 5_000;
    let mut read = chat(ConversationKind::Direct);
    read.last_read_seq = 2;
    let mut before_start = live(&notifier, 5, "from yesterday");
    before_start.ts = since(&notifier) - 1;
    let messages = [
        live(&notifier, 1, "a"),
        live(&notifier, 2, "b"),
        live(&notifier, 3, "c"),
        before_start,
    ];
    let fresh = notifier.fresh(&read, &messages, ME, &HashSet::new(), now);
    assert_eq!(
        fresh
            .iter()
            .map(|(message, _)| message.seq)
            .collect::<Vec<_>>(),
        [Some(3)]
    );
    assert!(
        notifier
            .fresh(&read, &messages, ME, &HashSet::new(), now)
            .is_empty()
    );
}

#[test]
fn quiet_chats_filter_out_plain_posts() {
    let notifier = Notifier::default();
    let now = since(&notifier) + 5_000;
    let mut mention = live(&notifier, 2, "@me");
    mention.mentions_me = true;
    let messages = [live(&notifier, 1, "hello room"), mention];
    let fresh = notifier.fresh(
        &chat(ConversationKind::Room),
        &messages,
        ME,
        &HashSet::new(),
        now,
    );
    assert_eq!(fresh.len(), 1);
    assert_eq!(fresh[0].1, Reason::Mention);
}

#[test]
fn an_event_about_me_wins_over_newer_posts() {
    let notifier = Notifier::default();
    let now = since(&notifier) + 5_000;
    let mut kicked = system(1, SystemKind::Kicked, ME);
    kicked.ts = since(&notifier) + 1_000;
    let messages = [kicked, live(&notifier, 2, "bye")];
    let fresh = notifier.fresh(
        &chat(ConversationKind::Direct),
        &messages,
        ME,
        &HashSet::new(),
        now,
    );
    let picked = pick(&fresh).map(|(message, reason)| (message.seq, *reason));
    assert_eq!(
        picked,
        Some((Some(1), Reason::Personal(SystemKind::Kicked)))
    );
}

#[test]
fn the_newest_post_is_picked() {
    let notifier = Notifier::default();
    let now = since(&notifier) + 5_000;
    let messages = [live(&notifier, 1, "a"), live(&notifier, 2, "b")];
    let fresh = notifier.fresh(
        &chat(ConversationKind::Direct),
        &messages,
        ME,
        &HashSet::new(),
        now,
    );
    assert_eq!(pick(&fresh).map(|(message, _)| message.seq), Some(Some(2)));
    assert!(pick(&[]).is_none());
}

#[test]
fn one_notification_per_chat_every_few_seconds() {
    let conversation = Uuid::from_u128(1);
    let other = Uuid::from_u128(2);
    let mut history = History::default();
    history.shown(conversation, 1_000);
    assert!(history.recently_shown(conversation, 1_000 + ONE_PER_CHAT_MS - 1));
    assert!(!history.recently_shown(conversation, 1_000 + ONE_PER_CHAT_MS));
    assert!(!history.recently_shown(other, 1_000));
}

#[test]
fn focus_soon_after_a_notification_opens_that_chat_once() {
    let first = Uuid::from_u128(1);
    let last = Uuid::from_u128(2);
    let mut history = History::default();
    history.shown(first, 1_000);
    history.shown(last, 2_000);
    assert_eq!(history.take_open(2_000 + OPEN_WITHIN_MS), Some(last));
    assert_eq!(history.take_open(2_000 + OPEN_WITHIN_MS), None);
}

#[test]
fn late_focus_or_a_device_alert_opens_nothing() {
    let conversation = Uuid::from_u128(1);
    let mut history = History::default();
    history.shown(conversation, 1_000);
    assert_eq!(history.take_open(1_000 + OPEN_WITHIN_MS + 1), None);
    history.shown(conversation, 5_000);
    history.forget_open();
    assert_eq!(history.take_open(5_001), None);
}

#[test]
fn a_device_alerts_once() {
    let device = Uuid::from_u128(9);
    let mut history = History::default();
    assert!(history.first_alert(device));
    assert!(!history.first_alert(device));
}

#[test]
fn seen_moves_only_forward() {
    let notifier = Notifier::default();
    let conversation = chat(ConversationKind::Direct).id;
    let mut history = History::default();
    assert_eq!(history.see(conversation, &[live(&notifier, 4, "a")]), 0);
    assert_eq!(history.see(conversation, &[live(&notifier, 2, "edit")]), 4);
    assert_eq!(history.see(conversation, &[]), 4);
}

#[test]
fn a_new_sign_in_moves_the_cutoff_but_a_reattach_keeps_it() {
    let notifier = Notifier::default();
    let store = sc_chat::store::Store::open_in_memory(&[7; 32]).expect("in-memory store");
    let store = std::sync::Arc::new(store);
    let channel = channel_at(NOW);
    notifier.since.store(1, Ordering::Release);
    notifier.attach(store.clone(), ME.to_owned(), channel.clone());
    let signed_in = since(&notifier);
    assert!(signed_in > 1);
    notifier.since.store(2, Ordering::Release);
    notifier.attach(store.clone(), ME.to_owned(), channel.clone());
    assert_eq!(since(&notifier), 2);
    notifier.detach();
    notifier.attach(store, ME.to_owned(), channel);
    assert!(since(&notifier) > 2);
}

#[test]
fn a_blocked_member_never_notifies_but_news_about_me_still_does() {
    let notifier = Notifier::default();
    let now = since(&notifier) + 5_000;
    let mut mention = live(&notifier, 1, "@me");
    mention.mentions_me = true;
    let mut kicked = system(2, SystemKind::Kicked, ME);
    kicked.ts = since(&notifier) + 1_000;
    let messages = [mention, kicked];
    let blocked = HashSet::from([ANN.to_owned()]);
    let fresh = notifier.fresh(&chat(ConversationKind::Group), &messages, ME, &blocked, now);
    assert_eq!(
        fresh
            .iter()
            .map(|(message, reason)| (message.seq, *reason))
            .collect::<Vec<_>>(),
        [(Some(2), Reason::Personal(SystemKind::Kicked))]
    );
}

#[test]
fn the_start_cutoff_follows_the_server_clock_not_a_skewed_local_one() {
    let notifier = Notifier::default();
    let store = sc_chat::store::Store::open_in_memory(&[7; 32]).expect("in-memory store");
    notifier.attach(std::sync::Arc::new(store), ME.to_owned(), channel_at(NOW));
    assert_eq!(since(&notifier), NOW);
    let mut before = text(1, "sent before the start");
    before.ts = NOW - 1;
    let mut after = text(2, "sent after the start");
    after.ts = NOW + 1;
    let messages = [before, after];
    let fresh = notifier.fresh(
        &chat(ConversationKind::Direct),
        &messages,
        ME,
        &HashSet::new(),
        NOW + 5_000,
    );
    assert_eq!(fresh.len(), 1);
    assert_eq!(fresh[0].0.seq, Some(2));
}
