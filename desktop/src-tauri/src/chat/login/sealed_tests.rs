use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sc_chat::crypto::DeviceKeys;
use sc_chat::sc_chat_wire::bind::verify_bind;
use sc_chat::sc_chat_wire::sign::verify_request;
use sc_chat::{ChatError, ChatResult, KeyName, KeyStorage, KeyStore, LoginBegin, Tier, Zeroizing};
use serde_json::json;

use super::exchange::Call;
use super::harness::{
    NOW, Origin, REQUEST, Reply, SESSION, begun, clock, login_call, send_one, signer,
};
use super::lane::Lane;
use super::{LINK_CLAIM, LOGIN, LOGIN_STATUS, claim_call, get, wire};

#[tokio::test]
async fn a_relogin_binds_this_device_to_the_current_session() {
    let origin = Origin::new(vec![Tier::Direct], vec![begun()]);
    let signer = signer();
    let answer = send_one(&origin.lane(), &origin, &signer, &login_call(Some(SESSION)))
        .await
        .unwrap();
    let begun: LoginBegin = wire::decode(&answer).unwrap();
    assert_eq!(begun.login_request_id, REQUEST);

    origin.seen(|seen| {
        let inner = &seen[0].inner;
        let bind = inner.bind.as_ref().unwrap();
        verify_bind(bind).unwrap();
        verify_request(&bind.auth_pub, inner, &seen[0].enc).unwrap();
        assert_eq!(bind.device_id, signer.device_id.to_string());
        assert_eq!(bind.auth_pub, signer.keys.auth_public());
        assert_eq!(bind.box_pub, signer.keys.box_public().unwrap());
        assert_eq!(inner.session_id.as_deref(), Some(SESSION));
        assert_eq!(inner.device_id, None);
        assert_eq!(inner.path, LOGIN);
    });
}

#[tokio::test]
async fn a_clock_answer_is_sent_again_once_with_the_server_time() {
    let ahead = NOW + 600_000;
    let origin = Origin::new(
        vec![Tier::Direct, Tier::Relay],
        vec![clock(Some(ahead)), begun()],
    );
    let answer = send_one(&origin.lane(), &origin, &signer(), &login_call(None))
        .await
        .unwrap();
    assert!(wire::decode::<LoginBegin>(&answer).is_ok());

    origin.seen(|seen| {
        assert_eq!(seen.len(), 2);
        assert!(seen.iter().all(|sent| sent.tier == Tier::Direct));
        assert_eq!(seen[0].inner.ts_ms, NOW as u64);
        assert_eq!(seen[1].inner.ts_ms, ahead as u64);
        assert_ne!(seen[0].enc, seen[1].enc);
    });
}

#[tokio::test]
async fn a_clock_answer_without_server_time_keeps_the_clock() {
    let origin = Origin::new(vec![Tier::Direct], vec![clock(None), begun()]);
    let lane = origin.lane();
    let signer = signer();
    let first = send_one(&lane, &origin, &signer, &login_call(None))
        .await
        .unwrap();
    assert_eq!(
        wire::decode::<LoginBegin>(&first),
        Err(ChatError::Clock { server_now: 0 })
    );
    send_one(&lane, &origin, &signer, &login_call(None))
        .await
        .unwrap();

    origin.seen(|seen| {
        assert_eq!(seen.len(), 2);
        assert_eq!(seen[1].inner.ts_ms, NOW as u64);
    });
}

#[tokio::test]
async fn a_forged_answer_moves_on_and_the_tier_that_answered_leads() {
    let origin = Origin::new(
        vec![Tier::Direct, Tier::Relay, Tier::Pro],
        vec![Reply::Forged, Reply::Down, begun(), begun()],
    );
    let lane = origin.lane();
    let signer = signer();
    send_one(&lane, &origin, &signer, &login_call(None))
        .await
        .unwrap();
    let status = Call::new(get(LOGIN_STATUS, format!("id={REQUEST}")), None, 10_000);
    send_one(&lane, &origin, &signer, &status).await.unwrap();

    origin.seen(|seen| {
        let tiers: Vec<Tier> = seen.iter().map(|sent| sent.tier).collect();
        assert_eq!(tiers, [Tier::Direct, Tier::Relay, Tier::Pro, Tier::Pro]);
        let first = seen[0].inner.bind.as_ref().unwrap();
        let last = seen[3].inner.bind.as_ref().unwrap();
        assert_eq!(first.auth_pub, last.auth_pub);
        assert_eq!(seen[3].inner.query, format!("id={REQUEST}"));
    });
}

#[tokio::test]
async fn every_tier_down_leaves_the_plain_flow() {
    let origin = Origin::new(
        vec![Tier::Direct, Tier::Relay],
        vec![Reply::Down, Reply::Forged],
    );
    let result = send_one(&origin.lane(), &origin, &signer(), &login_call(None)).await;
    assert_eq!(result.unwrap_err(), ChatError::Crypto);
}

#[derive(Default)]
struct SlowKeys(Mutex<HashMap<KeyName, Vec<u8>>>);

impl KeyStore for SlowKeys {
    fn storage(&self) -> KeyStorage {
        KeyStorage::File
    }

    fn load(&self, name: KeyName) -> ChatResult<Option<Zeroizing<Vec<u8>>>> {
        Ok(self
            .0
            .lock()
            .unwrap()
            .get(&name)
            .cloned()
            .map(Zeroizing::new))
    }

    fn save(&self, name: KeyName, secret: &[u8]) -> ChatResult<()> {
        std::thread::sleep(Duration::from_millis(20));
        self.0.lock().unwrap().insert(name, secret.to_vec());
        Ok(())
    }

    fn delete(&self, name: KeyName) -> ChatResult<()> {
        self.0.lock().unwrap().remove(&name);
        Ok(())
    }
}

#[tokio::test]
async fn two_flows_at_first_start_share_one_device() {
    let lane = Lane::new();
    let store: Arc<dyn KeyStore> = Arc::new(SlowKeys::default());
    let (login, link) = tokio::join!(lane.signer(store.clone()), lane.signer(store.clone()));
    let (login, link) = (login.unwrap(), link.unwrap());
    assert_eq!(login.device_id, link.device_id);
    assert_eq!(login.keys.auth_public(), link.keys.auth_public());
    let (stored_id, stored) = DeviceKeys::load_or_create(store.as_ref()).unwrap();
    assert_eq!(stored_id, login.device_id);
    assert_eq!(stored.box_public(), login.keys.box_public());
}

#[tokio::test]
async fn a_pull_claim_from_the_source_is_sealed_with_its_session() {
    let claimed = json!({ "sessionId": SESSION, "mode": "pull" });
    let origin = Origin::new(
        vec![Tier::Direct],
        vec![Reply::Answer(200, claimed.to_string())],
    );
    let signer = signer();
    let call = claim_call("claim-7", Some(SESSION.to_owned()));
    let answer = send_one(&origin.lane(), &origin, &signer, &call)
        .await
        .unwrap();
    let claimed: sc_chat::LinkClaimed = wire::decode(&answer).unwrap();
    assert_eq!(claimed.mode, sc_chat::LinkMode::Pull);

    origin.seen(|seen| {
        let inner = &seen[0].inner;
        let bind = inner.bind.as_ref().unwrap();
        verify_request(&bind.auth_pub, inner, &seen[0].enc).unwrap();
        assert_eq!(inner.method, "POST");
        assert_eq!(inner.path, LINK_CLAIM);
        assert_eq!(inner.session_id.as_deref(), Some(SESSION));
        let body: serde_json::Value = serde_json::from_slice(&inner.body).unwrap();
        assert_eq!(body["claimToken"], "claim-7");
    });
}
