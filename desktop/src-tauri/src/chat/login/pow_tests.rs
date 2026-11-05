use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use sc_chat::channel::BUSY_RETRY_MS;
use sc_chat::sc_chat_wire::pow::{POW_V, verify};
use sc_chat::sc_chat_wire::proto::Pow;
use sc_chat::{ChatError, LoginBegin, Tier};

use super::exchange::Call;
use super::harness::{
    Origin, REQUEST, Reply, begun, login_call, nodes, required, signer, switched_off,
};
use super::node::Node;
use super::pow::prove;
use super::{LINK_CREATE, LOGIN, LOGIN_STATUS, get, post, wire};

const VECTOR_PUB: [u8; 32] = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    26, 27, 28, 29, 30, 31,
];

fn vector() -> Pow {
    Pow {
        v: POW_V,
        seed: vec![7; 32],
        effort: 20,
        nonce: hex::decode("00000000000000000000000000000002").unwrap(),
        solution: hex::decode("5a559561b84137927e497d5f68ada6ec").unwrap(),
    }
}

#[derive(Default)]
struct Checks(Mutex<Vec<bool>>);

impl Checks {
    fn note(&self, on: bool) {
        self.0.lock().unwrap().push(on);
    }

    fn all(&self) -> Vec<bool> {
        self.0.lock().unwrap().clone()
    }
}

fn solved(origin: &Origin, at: usize, path: &str) -> Pow {
    origin.seen(|seen| {
        let inner = &seen[at].inner;
        let proof = inner.pow.clone().unwrap();
        let bind = inner.bind.as_ref().unwrap();
        assert_eq!(verify(&proof, &bind.auth_pub, path), Ok(()));
        proof
    })
}

#[test]
fn the_core_vector_is_bound_to_the_path_it_was_made_for() {
    assert_eq!(verify(&vector(), &VECTOR_PUB, "/auth/x"), Ok(()));
    assert!(verify(&vector(), &VECTOR_PUB, LOGIN).is_err());
}

#[tokio::test]
async fn a_proof_covers_the_inner_path_and_the_device_key() {
    let signer = signer();
    let cancel = Arc::new(AtomicBool::new(false));
    let proof = prove(&signer, LOGIN, vec![7; 32], 20, cancel)
        .await
        .unwrap();
    let key = signer.keys.auth_public();
    assert_eq!(verify(&proof, &key, LOGIN), Ok(()));
    assert!(verify(&proof, &key, "/auth/x").is_err());
    assert!(verify(&proof, &VECTOR_PUB, LOGIN).is_err());
    assert_eq!((proof.seed, proof.effort), (vec![7; 32], 20));
}

#[tokio::test]
async fn the_first_try_carries_only_the_capability_marker() {
    let main = Origin::new(vec![Tier::Direct], vec![begun()]);
    let star = Origin::beside(&main, Vec::new());
    let checks = Checks::default();
    let (node, answer) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|on| checks.note(on),
        )
        .await
        .unwrap();
    assert_eq!(node, Node::Main);
    assert!(wire::decode::<LoginBegin>(&answer).is_ok());
    assert!(checks.all().is_empty());
    main.seen(|seen| {
        let marker = seen[0].inner.pow.as_ref().unwrap();
        assert_eq!(marker.v, POW_V);
        assert!(marker.solution.is_empty() && marker.seed.is_empty() && marker.effort == 0);
    });
}

#[tokio::test]
async fn a_pow_answer_is_solved_and_resent_to_the_same_origin() {
    let main = Origin::new(vec![Tier::Direct], vec![required(7, 2), begun()]);
    let star = Origin::beside(&main, Vec::new());
    let checks = Checks::default();
    let (node, answer) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|on| checks.note(on),
        )
        .await
        .unwrap();
    assert_eq!(node, Node::Main);
    assert!(wire::decode::<LoginBegin>(&answer).is_ok());
    assert_eq!(checks.all(), [true, false]);
    assert_eq!(star.seen(|seen| seen.len()), 0);
    main.seen(|seen| {
        assert_eq!(seen.len(), 2);
        assert_ne!(seen[0].enc, seen[1].enc);
    });
    let proof = solved(&main, 1, LOGIN);
    assert_eq!((proof.seed, proof.effort), (vec![7; 32], 2));
}

#[tokio::test]
async fn a_pow_answer_from_star_is_answered_to_star() {
    let main = Origin::new(vec![Tier::Direct], vec![Reply::Down]);
    let star = Origin::beside(&main, vec![required(5, 2), begun()]);
    let (node, answer) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|_| {},
        )
        .await
        .unwrap();
    assert_eq!(node, Node::Star);
    assert!(wire::decode::<LoginBegin>(&answer).is_ok());
    assert_eq!(main.seen(|seen| seen.len()), 1);
    assert_eq!(star.seen(|seen| seen.len()), 2);
    assert_eq!(solved(&star, 1, LOGIN).seed, vec![5; 32]);
}

#[tokio::test]
async fn a_risen_effort_is_solved_again() {
    let main = Origin::new(
        vec![Tier::Direct],
        vec![required(7, 2), required(7, 6), begun()],
    );
    let star = Origin::beside(&main, Vec::new());
    let call = Call::new(
        post(LINK_CREATE, &serde_json::json!({ "mode": "pull" })),
        None,
        8_000,
    );
    let checks = Checks::default();
    let result = main
        .lane()
        .send(&nodes(&main, &star), &Node::ALL, &signer(), &call, &|on| {
            checks.note(on)
        })
        .await;
    assert_eq!(result.unwrap().0, Node::Main);
    assert_eq!(checks.all(), [true, false, true, false]);
    assert_eq!(solved(&main, 1, LINK_CREATE).effort, 2);
    assert_eq!(solved(&main, 2, LINK_CREATE).effort, 6);
    assert_eq!(star.seen(|seen| seen.len()), 0);
}

#[tokio::test]
async fn three_solved_rounds_that_still_fail_are_busy() {
    let script = (0..4).map(|_| required(7, 2)).collect();
    let main = Origin::new(vec![Tier::Direct], script);
    let star = Origin::beside(&main, Vec::new());
    let checks = Checks::default();
    let result = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|on| checks.note(on),
        )
        .await;
    assert_eq!(
        result.unwrap_err(),
        ChatError::Busy {
            retry_ms: BUSY_RETRY_MS
        }
    );
    assert_eq!(main.seen(|seen| seen.len()), 4);
    assert_eq!(checks.all(), [true, false, true, false, true, false]);
    assert_eq!(star.seen(|seen| seen.len()), 0);
}

#[tokio::test]
async fn star_answers_when_every_tier_of_main_misses() {
    let main = Origin::new(
        vec![Tier::Direct, Tier::Relay],
        vec![Reply::Down, Reply::Forged],
    );
    let star = Origin::beside(&main, vec![begun()]);
    let (node, _) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|_| {},
        )
        .await
        .unwrap();
    assert_eq!(node, Node::Star);
    assert_eq!(main.seen(|seen| seen.len()), 2);
    assert_eq!(star.seen(|seen| seen.len()), 1);
}

#[tokio::test]
async fn a_busy_main_does_not_send_the_client_to_star() {
    let busy = Reply::Answer(
        503,
        serde_json::json!({ "error": "chat_busy", "retry_ms": 900 }).to_string(),
    );
    let main = Origin::new(vec![Tier::Direct], vec![busy]);
    let star = Origin::beside(&main, Vec::new());
    let (node, answer) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|_| {},
        )
        .await
        .unwrap();
    assert_eq!(node, Node::Main);
    assert_eq!(
        wire::decode::<LoginBegin>(&answer),
        Err(ChatError::Busy { retry_ms: 900 })
    );
    assert_eq!(star.seen(|seen| seen.len()), 0);
}

#[tokio::test]
async fn polls_go_to_the_origin_that_answered_the_start() {
    let main = Origin::new(vec![Tier::Direct], vec![Reply::Down]);
    let star = Origin::beside(&main, vec![begun(), begun()]);
    let lane = main.lane();
    let signer = Arc::new(signer());
    let all = nodes(&main, &star);
    let (node, _) = lane
        .send(&all, &Node::ALL, &signer, &login_call(None), &|_| {})
        .await
        .unwrap();
    lane.hold(REQUEST, signer.clone(), node);

    let (held, at) = lane.held(REQUEST).unwrap();
    assert_eq!(at, Node::Star);
    let poll = Call::new(get(LOGIN_STATUS, format!("id={REQUEST}")), None, 10_000);
    lane.send(&all, &[at], &held, &poll, &|_| {}).await.unwrap();
    assert_eq!(main.seen(|seen| seen.len()), 1);
    star.seen(|seen| {
        assert_eq!(seen.len(), 2);
        assert_eq!(seen[1].inner.path, LOGIN_STATUS);
    });
}

#[tokio::test]
async fn the_server_switch_leaves_for_the_plain_flow_without_trying_star() {
    let main = Origin::new(vec![Tier::Direct], vec![switched_off()]);
    let star = Origin::beside(&main, Vec::new());
    let (_, answer) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|_| {},
        )
        .await
        .unwrap();
    assert_eq!(
        wire::decode::<LoginBegin>(&answer),
        Err(ChatError::Disabled)
    );
    assert_eq!(star.seen(|seen| seen.len()), 0);
}

#[tokio::test]
async fn a_missing_route_on_both_nodes_leaves_for_the_plain_flow() {
    let main = Origin::new(vec![Tier::Direct], vec![Reply::Missing]);
    let star = Origin::beside(&main, vec![Reply::Missing]);
    let result = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|_| {},
        )
        .await;
    assert_eq!(result.unwrap_err(), ChatError::Disabled);
    assert_eq!(star.seen(|seen| seen.len()), 1);
}

#[tokio::test]
async fn a_missing_route_on_main_alone_goes_on_to_star() {
    let main = Origin::new(vec![Tier::Direct], vec![Reply::Missing]);
    let star = Origin::beside(&main, vec![begun()]);
    let (node, _) = main
        .lane()
        .send(
            &nodes(&main, &star),
            &Node::ALL,
            &signer(),
            &login_call(None),
            &|_| {},
        )
        .await
        .unwrap();
    assert_eq!(node, Node::Star);
}

#[tokio::test]
async fn cancel_stops_the_solver() {
    let main = Origin::new(vec![Tier::Direct], vec![required(7, u32::MAX)]);
    let star = Origin::beside(&main, Vec::new());
    let lane = Arc::new(main.lane());
    let all = Arc::new(nodes(&main, &star));
    let checks = Arc::new(Checks::default());
    let flow = tokio::spawn({
        let (lane, all, checks) = (lane.clone(), all.clone(), checks.clone());
        async move {
            lane.send(&all, &Node::ALL, &signer(), &login_call(None), &|on| {
                checks.note(on)
            })
            .await
        }
    });
    while checks.all().is_empty() {
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    lane.cancel();
    let result = tokio::time::timeout(Duration::from_secs(20), flow)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(result.unwrap_err(), ChatError::NotReady);
    assert_eq!(checks.all(), [true, false]);
    assert_eq!(star.seen(|seen| seen.len()), 0);
}
