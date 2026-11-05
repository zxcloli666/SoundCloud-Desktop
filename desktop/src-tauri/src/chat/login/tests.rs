use std::cell::RefCell;
use std::sync::Arc;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sc_chat::channel::InnerAnswer;
use sc_chat::crypto::DeviceKeys;
use sc_chat::{
    ChatError, KeyStorage, KeyStore, LinkCreated, LinkMode, LinkState, LoginBegin, LoginState,
    LoginStep, Tier, TransportResponse,
};
use serde_json::{Value, json};
use uuid::Uuid;

use super::exchange::{Miss, Signer, outer, over_tiers};
use super::lane::{Lane, tier_order};
use super::node::Node;
use super::{by_id, get, post, swept_signer, wire};
use crate::chat::keychain::testing::SharedVault;
use crate::chat::keychain::{Keychain, ResetPlan};

fn answer(status: u16, body: Value) -> InnerAnswer {
    InnerAnswer {
        status,
        headers: vec![("content-type".to_owned(), "application/json".to_owned())],
        body: body.to_string().into_bytes(),
    }
}

fn with_retry_after(mut answer: InnerAnswer, seconds: &str) -> InnerAnswer {
    answer
        .headers
        .push(("Retry-After".to_owned(), seconds.to_owned()));
    answer
}

fn response(status: u16, retry_after_ms: Option<u64>) -> TransportResponse {
    TransportResponse {
        status,
        body: b"sealed".to_vec(),
        retry_after_ms,
    }
}

fn signer() -> Arc<Signer> {
    Arc::new(Signer {
        device_id: Uuid::nil(),
        keys: DeviceKeys::from_seeds([1; 32], [2; 32]),
    })
}

#[test]
fn status_queries_carry_only_a_uuid() {
    let id = "0b9f3f4e-2d52-4a8e-9f0a-6f1d2c3b4a59";
    assert_eq!(by_id(id), Ok(format!("id={id}")));
    assert_eq!(by_id("x\nid=other"), Err(ChatError::Invalid));
    assert_eq!(by_id(""), Err(ChatError::Invalid));
}

#[test]
fn calls_match_the_plain_auth_routes() {
    let status = get("/auth/login/status", "id=1".to_owned());
    assert_eq!(status.method, "GET");
    assert_eq!(status.path, "/auth/login/status");
    assert_eq!(status.query, "id=1");
    assert!(status.body.is_empty());

    let claim = post("/auth/link/claim", &json!({ "claimToken": "tok" }));
    assert_eq!(claim.method, "POST");
    assert!(claim.query.is_empty());
    let body: Value = serde_json::from_slice(&claim.body).unwrap();
    assert_eq!(body, json!({ "claimToken": "tok" }));
}

#[test]
fn login_begin_reads_the_server_answer() {
    let begun: LoginBegin = wire::decode(&answer(
        200,
        json!({ "url": "https://secure.soundcloud.com/authorize?x=1", "loginRequestId": "7c0c5f7e-0000-4000-8000-000000000001" }),
    ))
    .unwrap();
    assert_eq!(begun.url, "https://secure.soundcloud.com/authorize?x=1");
    assert_eq!(
        begun.login_request_id,
        "7c0c5f7e-0000-4000-8000-000000000001"
    );
}

#[test]
fn login_poll_keeps_going_on_unknown_values() {
    let pending = wire::login_poll(&answer(
        200,
        json!({ "status": "processing", "step": "warming", "extract": "ok" }),
    ))
    .unwrap();
    assert_eq!(pending.status, LoginState::Pending);
    assert_eq!(pending.step, None);

    let token = wire::login_poll(&answer(
        200,
        json!({ "status": "pending", "step": "token" }),
    ))
    .unwrap();
    assert_eq!(token.step, Some(LoginStep::Token));
}

#[test]
fn login_poll_hands_over_the_bound_session() {
    let done = wire::login_poll(&answer(
        200,
        json!({ "status": "completed", "sessionId": "s-1", "username": "neo", "redirectUrl": "https://x" }),
    ))
    .unwrap();
    assert_eq!(done.status, LoginState::Completed);
    assert_eq!(done.session_id.as_deref(), Some("s-1"));
    assert_eq!(done.username.as_deref(), Some("neo"));
    assert_eq!(done.redirect_url.as_deref(), Some("https://x"));

    let failed = wire::login_poll(&answer(
        200,
        json!({ "status": "failed", "error": "Authentication failed" }),
    ))
    .unwrap();
    assert_eq!(failed.status, LoginState::Failed);
    assert_eq!(failed.error.as_deref(), Some("Authentication failed"));
}

#[test]
fn a_pow_answer_hands_over_its_seed_and_effort() {
    let seed = [9u8; 32];
    let asked = answer(
        429,
        json!({ "error": "chat_pow_required", "v": 1, "seed": URL_SAFE_NO_PAD.encode(seed), "effort": 300 }),
    );
    assert_eq!(wire::pow_ticket(&asked), Some((seed.to_vec(), 300)));
    assert_eq!(
        wire::decode::<LoginBegin>(&asked),
        Err(ChatError::PowRequired {
            seed: seed.to_vec(),
            effort: 300
        })
    );

    let short = answer(
        429,
        json!({ "error": "chat_pow_required", "seed": "AAAA", "effort": 300 }),
    );
    assert_eq!(wire::pow_ticket(&short), None);
    assert_eq!(wire::pow_ticket(&answer(200, json!({}))), None);
    assert_eq!(
        wire::pow_ticket(&answer(429, json!({ "error": "chat_busy" }))),
        None
    );
}

#[test]
fn the_server_switch_reads_as_disabled() {
    let off = answer(503, json!({ "error": "chat_disabled" }));
    assert_eq!(wire::decode::<LoginBegin>(&off), Err(ChatError::Disabled));
}

#[test]
fn link_answers_decode() {
    let created: LinkCreated = wire::decode(&answer(
        200,
        json!({ "linkRequestId": "l-1", "claimToken": "tok", "expiresAt": 1_760_000_000_000_i64, "mode": "pull" }),
    ))
    .unwrap();
    assert_eq!(created.expires_at, 1_760_000_000_000);
    assert_eq!(created.mode, LinkMode::Pull);

    let claimed = wire::link_poll(&answer(
        200,
        json!({ "status": "claimed", "mode": "pull", "sessionId": "s-2" }),
    ))
    .unwrap();
    assert_eq!(claimed.status, LinkState::Claimed);
    assert_eq!(claimed.session_id.as_deref(), Some("s-2"));

    let odd =
        wire::link_poll(&answer(200, json!({ "status": "waiting", "mode": "push" }))).unwrap();
    assert_eq!(odd.status, LinkState::Pending);
    assert_eq!(odd.mode, LinkMode::Push);
}

#[test]
fn sealed_chat_errors_keep_their_code() {
    let clock = answer(401, json!({ "error": "chat_clock", "server_now": 42 }));
    assert_eq!(
        wire::decode::<LoginBegin>(&clock),
        Err(ChatError::Clock { server_now: 42 })
    );
    assert_eq!(wire::server_now(&clock), Some(42));

    let timeless = answer(401, json!({ "error": "chat_clock" }));
    assert_eq!(wire::server_now(&timeless), None);

    let busy = answer(503, json!({ "error": "chat_busy", "retry_ms": 700 }));
    assert_eq!(
        wire::decode::<LoginBegin>(&busy),
        Err(ChatError::Busy { retry_ms: 700 })
    );
    assert_eq!(wire::server_now(&busy), None);
}

#[test]
fn plain_auth_errors_map_to_chat_errors() {
    let limited = with_retry_after(
        answer(
            429,
            json!({ "statusCode": 429, "error": "Too Many Requests" }),
        ),
        "30",
    );
    assert_eq!(
        wire::decode::<LoginBegin>(&limited),
        Err(ChatError::Busy { retry_ms: 30_000 })
    );

    let unpaced = answer(429, json!({ "error": "Too Many Requests" }));
    assert_eq!(
        wire::decode::<LoginBegin>(&unpaced),
        Err(ChatError::Busy { retry_ms: 1_000 })
    );

    let expired = answer(
        400,
        json!({ "error": "Bad Request", "message": "Link token expired" }),
    );
    assert_eq!(
        wire::decode::<LoginBegin>(&expired),
        Err(ChatError::Invalid)
    );

    let used = answer(404, json!({ "error": "Not Found" }));
    assert_eq!(wire::decode::<LoginBegin>(&used), Err(ChatError::NotFound));

    let broken = InnerAnswer {
        status: 500,
        headers: Vec::new(),
        body: b"oops".to_vec(),
    };
    assert_eq!(
        wire::decode::<LoginBegin>(&broken),
        Err(ChatError::Internal)
    );
    assert_eq!(wire::server_now(&broken), None);
}

#[test]
fn a_garbled_success_is_a_protocol_error() {
    let garbled = answer(200, json!({ "unexpected": true }));
    assert_eq!(
        wire::decode::<LoginBegin>(&garbled),
        Err(ChatError::Protocol)
    );
    assert_eq!(wire::server_now(&garbled), None);
}

#[test]
fn outer_status_decides_between_next_tier_and_stop() {
    assert_eq!(outer(response(200, None)), Ok(b"sealed".to_vec()));
    assert_eq!(
        outer(response(503, Some(2_000))),
        Err(Miss::Fatal(ChatError::Busy { retry_ms: 2_000 }))
    );
    assert_eq!(
        outer(response(503, Some(86_400_000))),
        Err(Miss::Fatal(ChatError::Busy { retry_ms: 60_000 }))
    );
    assert_eq!(
        outer(response(503, Some(0))),
        Err(Miss::Fatal(ChatError::Busy { retry_ms: 1_000 }))
    );
    assert_eq!(
        outer(response(503, None)),
        Err(Miss::Tier(ChatError::Offline))
    );
    assert_eq!(
        outer(response(400, None)),
        Err(Miss::Tier(ChatError::Protocol))
    );
    assert_eq!(
        outer(response(413, None)),
        Err(Miss::Fatal(ChatError::Invalid))
    );
    assert_eq!(
        outer(response(404, None)),
        Err(Miss::Tier(ChatError::Disabled))
    );
    for blocked in [403, 502, 504] {
        assert_eq!(
            outer(response(blocked, None)),
            Err(Miss::Tier(ChatError::Offline))
        );
    }
}

#[tokio::test]
async fn the_first_tier_that_answers_wins() {
    let tried = RefCell::new(Vec::new());
    let result = over_tiers(vec![Tier::Direct, Tier::Relay, Tier::Pro], |tier| {
        tried.borrow_mut().push(tier);
        async move {
            match tier {
                Tier::Direct => Err(Miss::Tier(ChatError::Offline)),
                _ => Ok(answer(200, json!({}))),
            }
        }
    })
    .await;
    let (tier, _) = result.unwrap();
    assert_eq!(tier, Tier::Relay);
    assert_eq!(*tried.borrow(), vec![Tier::Direct, Tier::Relay]);
}

#[tokio::test]
async fn a_fatal_miss_stops_the_walk() {
    let tried = RefCell::new(Vec::new());
    let result = over_tiers(vec![Tier::Direct, Tier::Relay], |tier| {
        tried.borrow_mut().push(tier);
        async { Err(Miss::Fatal(ChatError::Busy { retry_ms: 5 })) }
    })
    .await;
    assert_eq!(
        result.unwrap_err(),
        Miss::Fatal(ChatError::Busy { retry_ms: 5 })
    );
    assert_eq!(*tried.borrow(), vec![Tier::Direct]);
}

#[tokio::test]
async fn every_tier_down_reports_the_last_miss() {
    let result = over_tiers(vec![Tier::Direct, Tier::Relay], |tier| async move {
        match tier {
            Tier::Direct => Err(Miss::Tier(ChatError::Offline)),
            _ => Err(Miss::Tier(ChatError::Protocol)),
        }
    })
    .await;
    assert_eq!(result.unwrap_err(), Miss::Tier(ChatError::Protocol));

    let nothing = over_tiers(Vec::new(), |_| async { Ok(answer(200, json!({}))) }).await;
    assert_eq!(nothing.unwrap_err(), Miss::Tier(ChatError::Offline));
}

#[test]
fn the_last_good_tier_goes_first() {
    let tiers = vec![Tier::Direct, Tier::Relay, Tier::Pro];
    assert_eq!(tier_order(tiers.clone(), None), tiers);
    assert_eq!(
        tier_order(tiers.clone(), Some(Tier::Pro)),
        vec![Tier::Pro, Tier::Direct, Tier::Relay]
    );
    assert_eq!(
        tier_order(tiers.clone(), Some(Tier::Relay)),
        vec![Tier::Relay, Tier::Direct, Tier::Pro]
    );
    assert_eq!(
        tier_order(vec![Tier::Direct, Tier::Relay], Some(Tier::Pro)),
        vec![Tier::Direct, Tier::Relay]
    );
}

#[test]
fn a_flow_keeps_its_keys_until_it_ends() {
    let lane = Lane::new();
    let held = signer();
    lane.hold("req-1", held.clone(), Node::Star);
    let (again, node) = lane.held("req-1").unwrap();
    assert!(Arc::ptr_eq(&held, &again));
    assert_eq!(node, Node::Star);
    assert_eq!(again.keys.auth_public(), held.keys.auth_public());
    assert!(lane.held("req-2").is_none());
    lane.release("req-1");
    assert!(lane.held("req-1").is_none());
}

#[test]
fn a_key_reset_drops_every_held_flow() {
    let lane = Lane::new();
    lane.hold("req-1", signer(), Node::Main);
    lane.hold("req-2", signer(), Node::Main);
    lane.release_all();
    assert!(lane.held("req-1").is_none());
    assert!(lane.held("req-2").is_none());
}

#[test]
fn link_modes_go_out_as_the_server_names_them() {
    assert_eq!(json!({ "mode": LinkMode::Pull }), json!({ "mode": "pull" }));
    assert_eq!(json!({ "mode": LinkMode::Push }), json!({ "mode": "push" }));
}

#[tokio::test]
async fn a_sign_in_after_a_refused_sign_out_starts_one_new_device() {
    let dir = std::env::temp_dir().join(format!("sc-chat-sign-in-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let vault = SharedVault::default();
    let before = Keychain::with_os(Box::new(vault.clone()), &dir);
    let (left, _) = DeviceKeys::load_or_create(&before).unwrap();
    vault.fail_with(Some(ChatError::KeychainDenied));
    assert_eq!(before.wipe().err(), Some(ChatError::KeychainDenied));
    drop(before);

    vault.fail_with(None);
    let restarted = Arc::new(Keychain::with_os(Box::new(vault.clone()), &dir));
    let lane = Lane::new();
    let signer = swept_signer(&lane, restarted.clone()).await.unwrap();
    assert_ne!(signer.device_id, left);
    assert!(!dir.join("keys-stale").exists());

    let again = swept_signer(&lane, restarted.clone()).await.unwrap();
    assert_eq!(again.device_id, signer.device_id);
    let (stored, keys) = DeviceKeys::load_or_create(restarted.as_ref()).unwrap();
    assert_eq!(stored, signer.device_id);
    assert_eq!(keys.auth_public(), signer.keys.auth_public());
    std::fs::remove_dir_all(dir).unwrap();
}

#[tokio::test]
async fn a_refused_store_ends_on_the_file_vault_after_the_reset_the_login_runs() {
    let dir = std::env::temp_dir().join(format!("sc-chat-refused-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&dir).unwrap();
    let vault = SharedVault::default();
    vault.fail_with(Some(ChatError::KeychainDenied));
    let keychain = Arc::new(Keychain::with_os(Box::new(vault.clone()), &dir));
    let lane = Lane::new();
    let refused = swept_signer(&lane, keychain.clone()).await.err();
    assert_eq!(refused, Some(ChatError::KeychainDenied));

    keychain.reset(ResetPlan::File).unwrap();
    let signer = swept_signer(&lane, keychain.clone()).await.unwrap();
    assert_eq!(keychain.storage(), KeyStorage::File);
    assert!(!keychain.denied());
    let (stored, keys) = DeviceKeys::load_or_create(keychain.as_ref()).unwrap();
    assert_eq!(stored, signer.device_id);
    assert_eq!(keys.auth_public(), signer.keys.auth_public());
    std::fs::remove_dir_all(dir).unwrap();
}
