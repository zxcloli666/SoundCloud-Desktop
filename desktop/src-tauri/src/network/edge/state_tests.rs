use std::time::{Duration, Instant};

use super::Tier;
use super::name::SERVICES;
use super::persist::{Persisted, restore, snapshot};
use super::state::{Change, Event, INHERIT, Inner, PROVEN_BYTES, REVALIDATE};

const IMAGES: &str = "images";
const STREAM: &str = "stream";

fn tier(inner: &Inner) -> Option<Tier> {
    inner.origins.get(IMAGES).map(|s| s.tier)
}

fn pinned(inner: &Inner, now: Instant) -> bool {
    inner.pinned(IMAGES, now)
}

fn apply(inner: &mut Inner, origin: &str, events: &[Event], now: Instant) -> Vec<Change> {
    events
        .iter()
        .map(|event| inner.apply(origin, *event, now))
        .collect()
}

fn pinned_inner(now: Instant) -> Inner {
    let mut inner = Inner::default();
    apply(&mut inner, IMAGES, &[Event::RelayWon, Event::RelayWon], now);
    assert!(pinned(&inner, now));
    inner
}

#[test]
fn every_inherit_pair_is_a_service_we_route() {
    for (origin, source) in INHERIT {
        assert!(SERVICES.contains(origin), "{origin} is not a service");
        assert!(SERVICES.contains(source), "{origin} inherits from {source}");
    }
}

#[test]
fn a_relay_only_service_starts_on_the_relays_without_any_state() {
    let mut inner = Inner::default();
    let now = Instant::now();
    assert_eq!(inner.level(STREAM, now), Tier::Relay);
    assert_eq!(inner.level(IMAGES, now), Tier::Direct);
    apply(
        &mut inner,
        STREAM,
        &[Event::RelayWon, Event::RelayWon, Event::DirectFailed],
        now,
    );
    assert!(inner.origins.is_empty());
    assert!(!inner.pinned(STREAM, now));
}

#[test]
fn a_direct_verdict_never_takes_a_relay_only_service_off_the_relays() {
    let mut inner = Inner::default();
    let now = Instant::now();
    assert_eq!(inner.conclude(STREAM, Tier::Direct, now), Change::None);
    assert_eq!(inner.conclude(STREAM, Tier::Relay, now), Change::None);
    assert_eq!(inner.level(STREAM, now), Tier::Relay);
}

#[test]
fn relays_that_keep_failing_move_a_relay_only_service_to_pro_and_back() {
    let mut inner = Inner::default();
    let now = Instant::now();
    let burst = apply(&mut inner, STREAM, &[Event::RelayFailed; 5], now);
    assert!(!burst.contains(&Change::Escalated));
    let later = now + Duration::from_secs(6);
    assert_eq!(
        inner.apply(STREAM, Event::RelayFailed, later),
        Change::Escalated
    );
    assert_eq!(inner.level(STREAM, later), Tier::Pro);
    assert_eq!(inner.level("storage", later), Tier::Pro);
    assert_eq!(inner.level("storage-star", later), Tier::Relay);

    let changes = apply(&mut inner, STREAM, &[Event::ProFailed; 3], later);
    assert_eq!(changes.last(), Some(&Change::Unpinned));
    assert_eq!(inner.level(STREAM, later), Tier::Relay);
}

#[test]
fn a_pro_pin_on_a_relay_only_service_runs_out_back_onto_the_relays() {
    let mut inner = Inner::default();
    let now = Instant::now();
    assert_eq!(inner.conclude(STREAM, Tier::Pro, now), Change::Escalated);
    assert_eq!(inner.level(STREAM, now), Tier::Pro);
    assert_eq!(inner.level(STREAM, now + REVALIDATE), Tier::Relay);
}

#[test]
fn lagging_relays_move_every_service_still_on_them() {
    let now = Instant::now();
    let mut inner = Inner::default();
    inner.conclude("api", Tier::Pro, now);
    let relayed = inner.relayed(now);
    assert!(relayed.contains(&STREAM));
    assert!(!relayed.contains(&"api"));
    assert!(!relayed.contains(&IMAGES));
    inner.conclude(IMAGES, Tier::Relay, now);
    assert!(inner.relayed(now).contains(&IMAGES));
}

#[test]
fn answered_headers_do_not_hide_bodies_that_keep_breaking() {
    let mut inner = Inner::default();
    let now = Instant::now();
    apply(
        &mut inner,
        IMAGES,
        &[
            Event::DirectFailed,
            Event::DirectAnswered,
            Event::DirectFailed,
        ],
        now,
    );
    assert_eq!(tier(&inner), Some(Tier::Relay));
}

#[test]
fn a_small_direct_answer_keeps_images_on_the_relay() {
    let now = Instant::now();
    let mut inner = pinned_inner(now);
    apply(
        &mut inner,
        IMAGES,
        &[
            Event::DirectAnswered,
            Event::DirectDelivered(PROVEN_BYTES - 1),
        ],
        now,
    );
    assert_eq!(tier(&inner), Some(Tier::Relay));
}

#[test]
fn a_whole_direct_body_brings_images_back() {
    let now = Instant::now();
    let mut inner = pinned_inner(now);
    assert_eq!(
        inner.apply(IMAGES, Event::DirectDelivered(PROVEN_BYTES), now),
        Change::Unpinned
    );
    assert_eq!(tier(&inner), Some(Tier::Direct));
    inner.apply(IMAGES, Event::DirectFailed, now);
    assert_eq!(tier(&inner), Some(Tier::Direct));
}

#[test]
fn failures_far_apart_do_not_add_up() {
    let mut inner = Inner::default();
    let now = Instant::now();
    inner.apply(IMAGES, Event::DirectFailed, now);
    inner.apply(
        IMAGES,
        Event::DirectFailed,
        now + REVALIDATE + Duration::from_secs(1),
    );
    assert_eq!(tier(&inner), Some(Tier::Direct));
}

#[test]
fn a_single_relay_win_does_not_pin() {
    let mut inner = Inner::default();
    let now = Instant::now();
    assert_eq!(
        apply(&mut inner, IMAGES, &[Event::RelayWon], now),
        [Change::None]
    );
    assert!(!pinned(&inner, now));
}

#[test]
fn two_relay_wins_in_a_row_pin() {
    let mut inner = Inner::default();
    let now = Instant::now();
    assert_eq!(
        apply(&mut inner, IMAGES, &[Event::RelayWon, Event::RelayWon], now),
        [Change::None, Change::Pinned]
    );
    assert!(pinned(&inner, now));
    assert!(!pinned(&inner, now + REVALIDATE));
}

#[test]
fn a_direct_answer_between_relay_wins_breaks_the_streak() {
    let mut inner = Inner::default();
    let now = Instant::now();
    apply(
        &mut inner,
        IMAGES,
        &[Event::RelayWon, Event::DirectAnswered, Event::RelayWon],
        now,
    );
    assert!(!pinned(&inner, now));
    apply(
        &mut inner,
        IMAGES,
        &[Event::DirectDelivered(10), Event::RelayWon],
        now,
    );
    assert!(!pinned(&inner, now));
}

#[test]
fn a_complete_direct_answer_breaks_the_failure_streak() {
    let mut inner = Inner::default();
    let now = Instant::now();
    apply(
        &mut inner,
        IMAGES,
        &[
            Event::DirectFailed,
            Event::DirectDelivered(10),
            Event::DirectFailed,
        ],
        now,
    );
    assert_eq!(tier(&inner), Some(Tier::Direct));
}

#[test]
fn a_pinned_images_relay_that_keeps_failing_gives_way_to_pro() {
    let now = Instant::now();
    let mut inner = pinned_inner(now);
    let burst = [Event::RelayFailed; 5];
    assert!(!apply(&mut inner, IMAGES, &burst, now).contains(&Change::Escalated));
    assert_eq!(tier(&inner), Some(Tier::Relay));

    let later = now + Duration::from_secs(6);
    assert_eq!(
        inner.apply(IMAGES, Event::RelayFailed, later),
        Change::Escalated
    );
    assert_eq!(inner.level(IMAGES, later), Tier::Pro);
}

#[test]
fn a_relay_win_forgives_earlier_relay_failures() {
    let now = Instant::now();
    let mut inner = pinned_inner(now);
    apply(&mut inner, IMAGES, &[Event::RelayFailed; 3], now);
    let later = now + Duration::from_secs(6);
    apply(
        &mut inner,
        IMAGES,
        &[Event::RelayWon, Event::RelayFailed],
        later,
    );
    assert_eq!(inner.level(IMAGES, later), Tier::Relay);
}

#[test]
fn a_pro_relay_that_keeps_failing_hands_images_back_to_direct() {
    let now = Instant::now();
    let mut inner = Inner::default();
    assert_eq!(inner.conclude(IMAGES, Tier::Pro, now), Change::Escalated);
    apply(
        &mut inner,
        IMAGES,
        &[Event::ProFailed, Event::ProFailed, Event::ProWon],
        now,
    );
    assert_eq!(inner.level(IMAGES, now), Tier::Pro);
    let changes = apply(&mut inner, IMAGES, &[Event::ProFailed; 3], now);
    assert_eq!(changes.last(), Some(&Change::Unpinned));
    assert_eq!(inner.level(IMAGES, now), Tier::Direct);
}

#[test]
fn a_proven_direct_route_ends_the_images_pro_pin() {
    let now = Instant::now();
    let mut inner = Inner::default();
    inner.conclude(IMAGES, Tier::Pro, now);
    assert_eq!(
        inner.apply(IMAGES, Event::DirectDelivered(PROVEN_BYTES), now),
        Change::Unpinned
    );
}

#[test]
fn relay_failures_never_pin_images() {
    let mut inner = Inner::default();
    let now = Instant::now();
    apply(
        &mut inner,
        IMAGES,
        &[Event::RelayFailed, Event::RelayFailed],
        now,
    );
    assert!(inner.origins.is_empty());
    apply(
        &mut inner,
        IMAGES,
        &[Event::RelayWon, Event::RelayFailed, Event::RelayFailed],
        now,
    );
    assert!(!pinned(&inner, now));
}

#[test]
fn an_expired_pin_needs_two_new_failures() {
    let now = Instant::now();
    let mut inner = pinned_inner(now);
    let later = now + REVALIDATE + Duration::from_secs(1);
    assert_eq!(
        inner.apply(IMAGES, Event::DirectFailed, later),
        Change::None
    );
    assert!(!pinned(&inner, later));
    assert_eq!(
        inner.apply(IMAGES, Event::DirectFailed, later),
        Change::Pinned
    );
    assert!(pinned(&inner, later));
}

#[test]
fn repeated_wins_do_not_extend_a_pin() {
    let now = Instant::now();
    let mut inner = pinned_inner(now);
    let until = inner.origins[IMAGES].until;
    let later = now + REVALIDATE / 2;
    assert_eq!(
        apply(
            &mut inner,
            IMAGES,
            &[
                Event::RelayWon,
                Event::RelayWon,
                Event::DirectFailed,
                Event::DirectFailed
            ],
            later,
        ),
        [Change::None; 4]
    );
    assert_eq!(inner.origins[IMAGES].until, until);
    assert!(!pinned(&inner, now + REVALIDATE));
    assert_eq!(
        inner.apply(IMAGES, Event::DirectFailed, now + REVALIDATE),
        Change::None
    );
}

#[test]
fn a_webview_conclusion_pins_images_at_once() {
    let mut inner = Inner::default();
    let now = Instant::now();
    assert_eq!(inner.conclude(IMAGES, Tier::Relay, now), Change::Pinned);
    assert!(pinned(&inner, now));
    assert_eq!(inner.conclude(IMAGES, Tier::Relay, now), Change::None);
    assert_eq!(inner.conclude(IMAGES, Tier::Direct, now), Change::Unpinned);
    assert!(!pinned(&inner, now));
    assert_eq!(inner.conclude(IMAGES, Tier::Direct, now), Change::None);
}

#[test]
fn a_pro_pin_survives_a_restart_and_expires_like_any_other() {
    let now = Instant::now();
    let mut inner = Inner::default();
    inner.conclude(STREAM, Tier::Pro, now);
    let saved = snapshot(&inner, now, 1_000);
    assert_eq!(saved.pro, vec![STREAM.to_string()]);

    let mut restored = Inner::default();
    restore(&mut restored, saved, now, 1_000);
    assert_eq!(restored.level(STREAM, now), Tier::Pro);
    let expired = now + REVALIDATE + Duration::from_secs(1);
    assert_eq!(restored.level(STREAM, expired), Tier::Relay);
}

#[test]
fn a_restart_keeps_only_the_remaining_pin_time() {
    let start = Instant::now();
    let now = start + REVALIDATE;
    let now_ms = 1_000_000_000;
    let mut inner = pinned_inner(now);
    inner.conclude("api", Tier::Pro, start);
    inner.conclude("pay", Tier::Pro, start + REVALIDATE / 2);
    let saved = snapshot(&inner, now, now_ms);
    assert_eq!(saved.pins.len(), 2);
    assert_eq!(saved.pins[IMAGES], now_ms + REVALIDATE.as_millis() as u64);
    assert!(!saved.pins.contains_key("api"));

    let mut pins = saved.pins;
    pins.insert("s3".into(), now_ms - 1);
    pins.insert(
        "stream".into(),
        now_ms + 100 * REVALIDATE.as_millis() as u64,
    );
    let later = now + Duration::from_secs(60);
    let mut restored = Inner::default();
    restore(
        &mut restored,
        Persisted {
            pins,
            pro: vec!["pay".into()],
        },
        later,
        now_ms + 60_000,
    );
    assert!(!restored.origins.contains_key("s3"));
    assert!(!restored.origins.contains_key("stream"));
    assert!(restored.pinned(IMAGES, later));
    assert!(!restored.pinned(IMAGES, now + REVALIDATE));
    assert_eq!(restored.level("pay", later), Tier::Pro);
    assert_eq!(restored.level("pay", now + REVALIDATE / 2), Tier::Relay);
    assert_eq!(restored.origins[IMAGES].direct_fails, 0);
}

#[test]
fn an_old_state_file_loads_as_no_pins() {
    let old: Persisted = serde_json::from_str(r#"{"tiers":{"api.scnative.dev":"relay"}}"#).unwrap();
    assert!(old.pins.is_empty());
    let host_keyed: Persisted = serde_json::from_str(
        r#"{"pins":{"stream.scnative.dev":99999999999999},"pro":["stream.scnative.dev"],"relay_only":["api"]}"#,
    )
    .unwrap();
    let mut inner = Inner::default();
    restore(&mut inner, old, Instant::now(), 1);
    restore(&mut inner, host_keyed, Instant::now(), 1);
    assert!(inner.origins.is_empty());
}
