use std::sync::{Arc, Mutex};
use std::time::Duration;

use sc_chat::api::wire::{ConfigView, LimitsView, MediaConfigView, MediaLimitsView};
use sc_chat::{Access, ChatPhase, ChatStatus, CoreEvent, Events, HistoryGate, Tier, TypingEvent};
use uuid::Uuid;

use super::bringup::{backoff, busy_retry, clock_retry, config_of};
use super::clock::spread;
use super::expiry::nap_of;
use super::lifecycle::{AuthMove, auth_move};
use super::signals::Signals;
use super::status::{StatusCell, take_engine_part};
use super::tap::Tap;
use super::wake::WakeWatch;

#[derive(Default)]
struct Seen(Mutex<Vec<CoreEvent>>);

impl Events for Seen {
    fn emit(&self, event: CoreEvent) {
        if let Ok(mut seen) = self.0.lock() {
            seen.push(event);
        }
    }
}

impl Seen {
    fn statuses(&self) -> Vec<ChatStatus> {
        self.0
            .lock()
            .unwrap()
            .iter()
            .filter_map(|event| match event {
                CoreEvent::Status(status) => Some(status.clone()),
                _ => None,
            })
            .collect()
    }
}

fn engine_status() -> ChatStatus {
    ChatStatus {
        online: true,
        tier: Some(Tier::Relay),
        visible: true,
        history: HistoryGate {
            locked: true,
            unlocks_at: Some(9),
        },
        unread: 4,
        mentions: 1,
        requests: 2,
        ..ChatStatus::off()
    }
}

#[test]
fn spread_stays_within_a_fifth_of_the_pause() {
    assert_eq!(spread(1_000, 0), 800);
    assert_eq!(spread(1_000, 400), 1_200);
    assert_eq!(spread(1_000, 9_999), 1_200);
}

#[test]
fn backoff_grows_and_caps_at_a_minute() {
    assert!(backoff(1) <= Duration::from_millis(2_400));
    assert!(backoff(3) >= Duration::from_millis(6_400));
    assert!(backoff(40) <= Duration::from_secs(72));
    assert!(backoff(40) >= Duration::from_secs(48));
}

#[test]
fn a_busy_bring_up_waits_at_least_two_seconds_give_or_take_a_fifth() {
    for _ in 0..20 {
        let short = busy_retry(1_000);
        assert!(short >= Duration::from_millis(1_600) && short <= Duration::from_millis(2_400));
        let long = busy_retry(10_000);
        assert!(long >= Duration::from_millis(8_000) && long <= Duration::from_millis(12_000));
    }
}

#[test]
fn a_repeated_clock_answer_backs_off() {
    assert_eq!(clock_retry(1), Duration::ZERO);
    assert!(clock_retry(2) >= Duration::from_millis(3_200));
    assert!(clock_retry(9) <= Duration::from_secs(72));
}

#[test]
fn the_expiry_sweep_naps_between_a_second_and_its_cap() {
    assert_eq!(nap_of(0), Duration::from_secs(1));
    assert_eq!(nap_of(3_000), Duration::from_secs(3));
    assert_eq!(nap_of(900_000), Duration::from_secs(15));
}

#[test]
fn a_late_tick_means_the_machine_slept() {
    let mut watch = WakeWatch::new(0);
    assert!(!watch.woke(5_000));
    assert!(!watch.woke(16_000));
    assert!(watch.woke(16_000 + 90_000));
    assert!(!watch.woke(16_000 + 95_000));
    assert!(watch.woke(0));
}

#[test]
fn only_a_change_of_visibility_counts() {
    let signals = Signals::new();
    assert!(!signals.visible());
    assert!(signals.set_visible(true));
    assert!(!signals.set_visible(true));
    assert!(signals.visible());
    assert!(signals.set_visible(false));
}

#[tokio::test]
async fn a_restart_reaches_every_waiter() {
    let signals = Arc::new(Signals::new());
    let generation = signals.generation();
    let waiter = {
        let signals = signals.clone();
        tokio::spawn(async move { signals.restarted(generation).await })
    };
    signals.restart();
    tokio::time::timeout(Duration::from_millis(200), waiter)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(signals.generation(), generation + 1);
}

#[test]
fn the_engine_owns_delivery_and_counts_and_the_runtime_owns_the_rest() {
    let device = Uuid::new_v4();
    let mut status = ChatStatus {
        phase: ChatPhase::Ready,
        device_id: Some(device),
        send_paused: true,
        ..ChatStatus::off()
    };
    take_engine_part(&mut status, &engine_status());
    assert_eq!(status.phase, ChatPhase::Ready);
    assert_eq!(status.device_id, Some(device));
    assert!(status.send_paused);
    assert!(status.online && status.visible && status.history.locked);
    assert_eq!(status.tier, Some(Tier::Relay));
    assert_eq!((status.unread, status.mentions, status.requests), (4, 1, 2));
}

#[test]
fn engine_statuses_reach_the_webview_only_through_the_runtime_status() {
    let seen = Arc::new(Seen::default());
    let status = Arc::new(StatusCell::new(seen.clone()));
    status.update(|status| status.phase = ChatPhase::Ready);
    let tap = Tap::new(seen.clone(), status.clone());
    tap.emit(CoreEvent::Status(engine_status()));
    tap.emit(CoreEvent::Status(engine_status()));
    let statuses = seen.statuses();
    assert_eq!(statuses.len(), 2);
    assert!(
        statuses
            .iter()
            .all(|status| status.phase == ChatPhase::Ready)
    );
    assert_eq!(statuses[1].unread, 4);
    assert_eq!(status.get().phase, ChatPhase::Ready);
}

#[test]
fn typing_is_remembered_for_an_open_thread() {
    let seen = Arc::new(Seen::default());
    let tap = Tap::new(seen.clone(), Arc::new(StatusCell::new(seen.clone())));
    let conversation_id = Uuid::new_v4();
    tap.emit(CoreEvent::Typing(TypingEvent {
        conversation_id,
        users: vec!["7".into()],
    }));
    assert_eq!(tap.typing(conversation_id), ["7"]);
    assert!(tap.typing(Uuid::new_v4()).is_empty());
}

#[test]
fn a_music_logout_drops_the_chat_device() {
    assert_eq!(
        auth_move(true, false, true, ChatPhase::Ready),
        AuthMove::DropDevice
    );
    assert_eq!(
        auth_move(true, false, true, ChatPhase::Off),
        AuthMove::DropDevice
    );
    assert_eq!(
        auth_move(false, false, false, ChatPhase::SignedOut),
        AuthMove::Stay
    );
}

#[test]
fn a_new_session_or_a_relogin_from_a_stuck_phase_restarts() {
    assert_eq!(
        auth_move(false, true, true, ChatPhase::SignedOut),
        AuthMove::Restart
    );
    assert_eq!(
        auth_move(true, true, true, ChatPhase::Ready),
        AuthMove::Restart
    );
    for stuck in [
        ChatPhase::Unbound,
        ChatPhase::BoundOther,
        ChatPhase::Revoked,
    ] {
        assert_eq!(auth_move(true, true, false, stuck), AuthMove::Restart);
    }
    assert_eq!(
        auth_move(true, true, false, ChatPhase::Ready),
        AuthMove::Stay
    );
    assert_eq!(auth_move(true, true, false, ChatPhase::Off), AuthMove::Stay);
}

#[test]
fn server_config_maps_to_the_client_config() {
    let config = config_of(ConfigView {
        enabled: true,
        access: "all".into(),
        send_paused: false,
        hold_max_ms: 20_000,
        server_now: 42,
        incarnation: Uuid::nil(),
        ock_current: 1,
        limits: LimitsView {
            text_max: 4096,
            embeds_max: 3,
            group_members_max: 200,
            devices_max: 10,
            envelope_max: 65_536,
            disappearing_ttls: vec![3_600, 86_400, 604_800],
        },
        user_id: Some("100".into()),
        media: MediaConfigView {
            uploads: true,
            star: true,
            quota: 1_073_741_824,
            used: 7_340_032,
            limits: MediaLimitsView {
                image_max_bytes: 614_400,
                thumb_max_bytes: 32_768,
                avatar_max_bytes: 65_536,
                album_max: 10,
                room_album_max: 4,
                restore_window_s: 15,
            },
        },
    });
    assert_eq!(config.access, Access::All);
    assert_eq!(config.limits.group_members_max, 200);
    assert!(config.media.uploads);
    assert!(config.media.star);
    assert_eq!(config.media.used, 7_340_032);
    assert_eq!(config.media.limits.room_album_max, 4);
    let beta = config_of(ConfigView {
        enabled: false,
        access: "beta".into(),
        send_paused: true,
        hold_max_ms: 15_000,
        server_now: 7,
        incarnation: Uuid::nil(),
        ock_current: 2,
        limits: LimitsView {
            text_max: 1,
            embeds_max: 1,
            group_members_max: 1,
            devices_max: 1,
            envelope_max: 1,
            disappearing_ttls: Vec::new(),
        },
        user_id: None,
        media: MediaConfigView::default(),
    });
    assert_eq!(beta.access, Access::Beta);
    assert!(!beta.media.uploads);
    assert!(!beta.media.star);
    assert!(beta.send_paused);
    assert_eq!(beta.ock_current, 2);
}
