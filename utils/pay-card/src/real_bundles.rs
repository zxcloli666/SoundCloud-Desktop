use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};
use url::Url;

use crate::bundle::{self, Flow};
use crate::outcome::Outcome;
use crate::testkit::{
    self, CANCELLED_BARE, CAPTURE_TIMEOUT, CVV, FAILED, FakeSg, FakeYuno, NOW, NUMBER, PENDING,
    REDIRECT, REDIRECT_GET, REDIRECT_POST, SUCCEEDED, open_real,
};
use crate::visit::{PageEnd, Visit, visit};

const RESULT: &str = "https://pay.boosty.to/app/payment/result";

async fn bind(sg: Arc<FakeSg>, name: &str) -> Outcome {
    open_real("bind", testkit::bind_params(), sg, name)
        .submit(testkit::card())
        .await
        .unwrap()
}

#[test]
fn every_real_bundle_verifies_with_its_key_entry_and_flow() {
    for (entry, flow) in [
        ("bind", Flow::CardForm),
        ("token", Flow::CardForm),
        ("confirm", Flow::Confirm),
    ] {
        let real = testkit::real(entry);
        assert_eq!(
            bundle::check(&real, &testkit::real_keys(), NOW, 0),
            Ok(()),
            "{entry}"
        );
        assert_eq!((real.entry.as_str(), real.flow), (entry, flow));
        assert!(real.serial > bundle::SERIAL_FLOOR);
        assert_eq!(real.result_url, RESULT);
    }
}

#[tokio::test]
async fn the_bind_script_walks_the_widget_and_asks_for_the_bank_page() {
    let sg = FakeSg::new(REDIRECT);
    let outcome = bind(sg.clone(), "real-redirect").await;
    assert_eq!(
        outcome,
        Outcome::Page {
            page_url: "https://acs.payeko.ru/3ds?id=1".into()
        }
    );
    assert_eq!(
        sg.paths(),
        [
            "/widget/v1/init",
            "/cds/v1/tokenize/elements",
            "/cds/v1/tokenize/elements",
            "/cds/v1/tokenize/elements",
            "/cds/v1/tokenize/elements",
            "/widget/v1/payment"
        ]
    );
}

#[tokio::test]
async fn the_card_goes_only_into_tokenize_bodies_on_the_allowed_host() {
    let sg = FakeSg::new(REDIRECT);
    let outcome = bind(sg.clone(), "real-where-card-goes").await;
    let mut carriers = vec![];
    for request in sg.seen.lock().unwrap().iter() {
        let url = Url::parse(&request.url).unwrap();
        assert_eq!(url.host_str(), Some("proxy-ee.smart-glocal.com"));
        let body = String::from_utf8_lossy(&request.body).to_string();
        let headers = format!("{:?}", request.headers);
        assert!(
            !request.url.contains(NUMBER) && !headers.contains(NUMBER) && !headers.contains(CVV)
        );
        assert!(headers.contains("public-token"));
        if body.contains(NUMBER) || body.contains(CVV) {
            carriers.push(url.path().to_string());
        }
        if body.contains("\"cardholder\"") {
            assert!(body.contains("\"CARD HOLDER\""), "{body}");
        }
    }
    assert_eq!(carriers, ["/cds/v1/tokenize/elements"; 2]);
    assert!(!format!("{outcome:?}").contains(NUMBER));
}

#[tokio::test]
async fn the_bind_script_maps_the_gateway_answer_to_a_normalized_outcome() {
    for (payment, expected) in [
        (SUCCEEDED, Outcome::Succeeded { reason: None }),
        (PENDING, Outcome::Pending { reason: None }),
        (FAILED, Outcome::failed("do_not_honor")),
        (CAPTURE_TIMEOUT, Outcome::failed("capture_timeout")),
        (CANCELLED_BARE, Outcome::failed("cancelled")),
        (REDIRECT_POST, Outcome::failed("redirect_method")),
        (
            REDIRECT_GET,
            Outcome::Page {
                page_url: "https://acs.payeko.ru/3ds?mdOrder=1".into(),
            },
        ),
    ] {
        assert_eq!(
            bind(FakeSg::new(payment), "real-map").await,
            expected,
            "{payment}"
        );
    }
    assert_eq!(
        bind(FakeSg::with_code("{}", 422), "real-422").await,
        Outcome::failed("payment")
    );
}

#[tokio::test]
async fn a_refused_field_goes_back_to_the_form_before_any_payment() {
    for (kind, status, field) in [
        ("card_number", 400, "number"),
        ("expire_date", 422, "expiry"),
        ("cvv", 400, "cvv"),
    ] {
        let sg = FakeSg::refusing(kind, status);
        assert_eq!(
            bind(sg.clone(), "real-refused").await,
            Outcome::Invalid {
                field: field.into()
            }
        );
        assert!(!sg.paths().iter().any(|path| path.ends_with("/payment")));
    }
    assert_eq!(
        bind(FakeSg::refusing("cardholder", 400), "real-holder").await,
        Outcome::failed("tokenize_cardholder")
    );
    for status in [429, 500, 503] {
        assert_eq!(
            bind(FakeSg::refusing("card_number", status), "real-outage").await,
            Outcome::failed("tokenize_card_number")
        );
    }
}

#[tokio::test]
async fn the_bind_script_needs_its_params() {
    let sg = FakeSg::new(SUCCEEDED);
    let session = open_real("bind", json!({"payment_id": 1}), sg.clone(), "real-params");
    assert_eq!(
        session.submit(testkit::card()).await.unwrap(),
        Outcome::failed("params")
    );
    assert!(sg.seen.lock().unwrap().is_empty());
}

#[tokio::test]
async fn the_result_page_verdict_comes_back_as_pending_for_pay_to_settle() {
    let session = open_real(
        "bind",
        testkit::bind_params(),
        FakeSg::new(PENDING),
        "real-result",
    );
    assert_eq!(
        session
            .result(format!("{RESULT}?result=success"))
            .await
            .unwrap(),
        Outcome::Pending { reason: None }
    );
    assert_eq!(
        session
            .result(format!("{RESULT}?result=fail"))
            .await
            .unwrap(),
        Outcome::Pending {
            reason: Some("confirm_failed".into())
        }
    );
}

async fn token(yuno: Arc<FakeYuno>, name: &str) -> Outcome {
    open_real("token", testkit::yuno_params(), yuno, name)
        .submit(testkit::card())
        .await
        .unwrap()
}

#[tokio::test]
async fn the_token_script_turns_the_card_into_a_token() {
    let yuno = FakeYuno::new(
        200,
        json!({"token": "tok-1", "card_data": {"iin": "424242", "lfd": "4242"}}),
    );
    assert_eq!(
        token(yuno.clone(), "real-token").await,
        Outcome::Token {
            token: "tok-1".into()
        }
    );
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
    assert_eq!(
        (
            card["expiration_month"].clone(),
            card["expiration_year"].clone()
        ),
        (json!(12), json!(28))
    );
    assert_eq!(card["holder_name"], "CARD HOLDER");
    let browser = &body["payment_method"]["customer"]["browser_info"];
    assert_eq!(browser["browser_time_difference"], "-180");
    assert_eq!(browser["language"], "ru-RU");
}

#[tokio::test]
async fn the_token_script_sends_a_refused_number_back_and_fails_an_outage() {
    for status in [400, 422] {
        assert_eq!(
            token(FakeYuno::new(status, json!({})), "real-token-refused").await,
            Outcome::Invalid {
                field: "number".into()
            }
        );
    }
    for status in [401, 404, 429, 500] {
        assert_eq!(
            token(FakeYuno::new(status, json!({})), "real-token-outage").await,
            Outcome::failed("token")
        );
    }
    assert_eq!(
        token(
            FakeYuno::new(200, json!({"token": "bad token\n"})),
            "real-token-bad"
        )
        .await,
        Outcome::failed("bad_token")
    );
}

#[tokio::test]
async fn token_pages_open_only_on_its_page_hosts() {
    let session = open_real(
        "token",
        testkit::yuno_params(),
        FakeYuno::new(200, json!({})),
        "real-token-pages",
    );
    assert!(session.takes_page("https://checkout.y.uno/payment?session=s1&3ds=true"));
    assert!(!session.takes_page("https://evil.example/"));
}

#[tokio::test]
async fn the_confirm_bundle_has_no_form_and_reads_only_the_result() {
    let session = open_real("confirm", json!({}), FakeSg::new(PENDING), "real-confirm");
    assert!(session.submit(testkit::card()).await.is_err());
    assert!(session.takes_page("https://pay.boosty.to/app/confirm?id=1"));
    assert!(!session.takes_page("https://acs.payeko.ru/3ds"));
    let shown = Mutex::new(vec![]);
    let reached = visit(
        &session,
        "https://pay.boosty.to/app/confirm?id=1",
        Duration::from_secs(5),
        async |url: String| {
            shown.lock().unwrap().push(url);
            PageEnd::Reached(format!("{RESULT}?result=success"))
        },
    )
    .await;
    assert_eq!(
        reached,
        Visit::Result {
            outcome: Outcome::Pending { reason: None }
        }
    );
    assert_eq!(
        shown.lock().unwrap().as_slice(),
        ["https://pay.boosty.to/app/confirm?id=1"]
    );
}

#[tokio::test]
async fn a_visit_is_refused_off_its_hosts_and_closed_on_close_or_budget() {
    let session = open_real("confirm", json!({}), FakeSg::new(PENDING), "real-visit");
    let never = async |_: String| -> PageEnd { std::future::pending().await };
    assert_eq!(
        visit(
            &session,
            "https://evil.example/",
            Duration::from_secs(5),
            never
        )
        .await,
        Visit::Refused
    );
    assert_eq!(
        visit(
            &session,
            "https://pay.boosty.to/x",
            Duration::from_secs(5),
            async |_: String| PageEnd::Closed
        )
        .await,
        Visit::Closed
    );
    assert_eq!(
        visit(
            &session,
            "https://pay.boosty.to/x",
            Duration::from_millis(50),
            never
        )
        .await,
        Visit::Closed
    );
    let fail = visit(
        &session,
        "https://pay.boosty.to/x",
        Duration::from_secs(5),
        async |_: String| PageEnd::Reached("https://pay.boosty.to/elsewhere".into()),
    )
    .await;
    assert_eq!(
        fail,
        Visit::Result {
            outcome: Outcome::failed("sandbox")
        }
    );
}

#[test]
fn a_visit_serializes_flat_for_the_front() {
    let shown = serde_json::to_string(&Visit::Result {
        outcome: Outcome::Pending { reason: None },
    })
    .unwrap();
    assert_eq!(shown, r#"{"end":"result","outcome":{"state":"pending"}}"#);
    assert_eq!(
        serde_json::to_string(&Visit::Closed).unwrap(),
        r#"{"end":"closed"}"#
    );
}
