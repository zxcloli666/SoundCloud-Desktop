use serde::Deserialize;

use crate::card::Card;
use crate::flow::{Phase, Verdict};
use crate::outcome;
use crate::session::Session;

const TOKEN_LEN: usize = 200;
const REFUSED_NUMBER: [u16; 2] = [400, 422];

#[derive(Deserialize)]
pub(crate) struct TokenReply {
    ok: Option<bool>,
    token: Option<String>,
    reason: Option<String>,
    status: Option<u16>,
}

pub async fn tokenize(session: &Session, card: Card, phase: impl Fn(Phase)) -> Verdict {
    phase(Phase::Sending);
    match session.token(card).await {
        Ok(reply) => verdict_of(reply),
        Err(error) => failed(error.code()),
    }
}

fn verdict_of(reply: TokenReply) -> Verdict {
    if reply.ok == Some(true) {
        return match reply.token.filter(|token| clean(token)) {
            Some(token) => Verdict::Tokenized { token },
            None => failed("bad_token"),
        };
    }
    let reason = reply
        .reason
        .as_deref()
        .map_or("unknown".into(), outcome::code);
    let field = match (reason.as_str(), reply.status) {
        ("expiry_format", _) => Some("expiry"),
        ("token", Some(status)) if REFUSED_NUMBER.contains(&status) => Some("number"),
        _ => None,
    };
    match field {
        Some(field) => Verdict::Invalid {
            field: field.into(),
        },
        None => failed(&reason),
    }
}

fn clean(token: &str) -> bool {
    !token.is_empty()
        && token.len() <= TOKEN_LEN
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b':'))
}

fn failed(reason: &str) -> Verdict {
    Verdict::Failed {
        reason: reason.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use serde_json::{Value, json};
    use url::Url;

    use super::*;
    use crate::testkit::{self, CVV, FakeYuno, NUMBER};

    async fn run(yuno: std::sync::Arc<FakeYuno>, name: &str) -> (Verdict, Vec<Phase>) {
        let session = testkit::yuno_session(yuno, name);
        let phases = Mutex::new(vec![]);
        let verdict = tokenize(&session, testkit::card(), |phase| {
            phases.lock().unwrap().push(phase)
        })
        .await;
        (verdict, phases.into_inner().unwrap())
    }

    #[tokio::test]
    async fn the_real_yuno_script_turns_the_card_into_a_token() {
        let yuno = FakeYuno::new(
            200,
            json!({"token": "tok-1", "card_data": {"iin": "424242", "lfd": "4242", "brand": "VISA"}}),
        );
        let (verdict, phases) = run(yuno.clone(), "yuno-ok").await;
        assert_eq!(
            verdict,
            Verdict::Tokenized {
                token: "tok-1".into()
            }
        );
        assert_eq!(phases, [Phase::Sending]);
        let seen = yuno.seen.lock().unwrap();
        assert_eq!(seen.len(), 1);
        let url = Url::parse(&seen[0].url).unwrap();
        assert_eq!(url.host_str(), Some("api.y.uno"));
        assert_eq!(url.path(), "/v1/checkout/sessions/cs-1/token");
        let headers = format!("{:?}", seen[0].headers);
        assert!(headers.contains("pk-1") && !headers.contains(NUMBER));
        let body: Value = serde_json::from_slice(&seen[0].body).unwrap();
        let card = &body["payment_method"]["card"];
        assert_eq!(card["number"], NUMBER);
        assert_eq!(card["security_code"], CVV);
        assert_eq!(card["expiration_month"], 12);
        assert_eq!(card["expiration_year"], 28);
        assert_eq!(card["holder_name"], "CARD HOLDER");
        let browser = &body["payment_method"]["customer"]["browser_info"];
        assert_eq!(browser["browser_time_difference"], "-180");
        assert_eq!(browser["language"], "ru-RU");
    }

    #[tokio::test]
    async fn the_verdict_carries_only_the_token() {
        let yuno = FakeYuno::new(
            200,
            json!({"token": "tok-2", "card_data": {"iin": "424242", "lfd": "4242"}}),
        );
        let (verdict, _) = run(yuno, "yuno-only-token").await;
        let shown = serde_json::to_string(&verdict).unwrap();
        assert_eq!(shown, r#"{"state":"tokenized","token":"tok-2"}"#);
    }

    #[tokio::test]
    async fn a_refused_number_goes_back_to_the_form() {
        for status in [400, 422] {
            let yuno = FakeYuno::new(status, json!({"code": "INVALID_CARD"}));
            let (verdict, _) = run(yuno, &format!("yuno-refused-{status}")).await;
            assert_eq!(
                verdict,
                Verdict::Invalid {
                    field: "number".into()
                },
                "{status}"
            );
        }
    }

    #[tokio::test]
    async fn an_outage_or_a_dead_session_is_a_failure_not_a_bad_field() {
        for status in [401, 404, 429, 500, 503] {
            let yuno = FakeYuno::new(status, json!({}));
            let (verdict, _) = run(yuno, &format!("yuno-outage-{status}")).await;
            assert_eq!(
                verdict,
                Verdict::Failed {
                    reason: "token".into()
                },
                "{status}"
            );
        }
        let yuno = FakeYuno::new(200, json!({"no_token": true}));
        let (verdict, _) = run(yuno, "yuno-no-token").await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "token".into()
            }
        );
    }

    #[test]
    fn replies_map_to_verdicts() {
        let reply = |value: Value| verdict_of(serde_json::from_value(value).unwrap());
        assert_eq!(
            reply(json!({"ok": false, "reason": "expiry_format"})),
            Verdict::Invalid {
                field: "expiry".into()
            }
        );
        assert_eq!(
            reply(json!({"ok": false, "reason": "input"})),
            failed("input")
        );
        assert_eq!(
            reply(json!({"ok": true, "token": "bad token\n"})),
            failed("bad_token")
        );
        assert_eq!(
            reply(json!({"ok": true, "token": "x".repeat(201)})),
            failed("bad_token")
        );
        assert_eq!(reply(json!({"ok": true})), failed("bad_token"));
        assert_eq!(
            reply(json!({"ok": false, "reason": "Card 4242 declined!"})),
            failed("ard4242declined")
        );
    }

    #[tokio::test]
    async fn a_token_session_never_runs_the_bind_flow() {
        let session = testkit::yuno_session(FakeYuno::new(200, json!({})), "yuno-no-bind");
        assert!(session.bind(testkit::card()).await.is_err());
        assert!(session.status().await.is_err());
    }
}
