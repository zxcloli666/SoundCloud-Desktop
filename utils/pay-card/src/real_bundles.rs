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
            "/widget/v1/card/42424242424",
            "/cds/v1/tokenize/elements",
            "/cds/v1/tokenize/elements",
            "/cds/v1/tokenize/elements",
            "/widget/v1/payment"
        ]
    );
}

fn payment_card(sg: &FakeSg) -> Value {
    let seen = sg.seen.lock().unwrap();
    let payment = seen
        .iter()
        .find(|request| request.url.ends_with("/widget/v1/payment"))
        .unwrap();
    let body: Value = serde_json::from_slice(&payment.body).unwrap();
    body["payment_details"]["card"]["encrypted_card"].clone()
}

#[tokio::test]
async fn with_the_widget_key_the_card_is_sealed_like_the_widget_does_it() {
    let sg = FakeSg::sealing(REDIRECT);
    let outcome = bind(sg.clone(), "real-sealed").await;
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
            "/widget/v1/card/42424242424",
            "/cds/v2/tokenize/elements",
            "/cds/v2/tokenize/elements",
            "/cds/v2/tokenize/elements",
            "/widget/v1/payment"
        ]
    );
    for request in sg.seen.lock().unwrap().iter() {
        let body = String::from_utf8_lossy(&request.body).to_string();
        assert!(
            !body.contains(NUMBER) && !body.contains(CVV),
            "{}",
            request.url
        );
        if request.url.ends_with("/cds/v2/tokenize/elements") {
            assert!(
                request
                    .headers
                    .contains(&("Content-Type".into(), "text/plain".into()))
            );
            assert_eq!(body.split('.').count(), 5);
        }
    }
    assert_eq!(
        *sg.opened.lock().unwrap(),
        [
            json!({"card_elements": [{"ref": "card_number", "type": "card_number", "card_number": NUMBER}]}),
            json!({"card_elements": [{"ref": "expire_date", "type": "expire_date", "expire_date": {"month": 12, "year": 28}}]}),
            json!({"card_elements": [{"ref": "cvv", "type": "cvv", "cvv": CVV}]}),
        ]
    );
    assert_eq!(
        payment_card(&sg),
        json!({"number_hash": "hash-card_number", "expiration_date_hash": "hash-expire_date", "security_code_hash": "hash-cvv"})
    );
}

#[tokio::test]
async fn a_sealed_field_the_gateway_refuses_goes_back_to_the_form() {
    let sg = FakeSg::sealing_with(
        PENDING,
        Some(("card_number", 400)),
        testkit::sealing_key(),
        200,
    );
    assert_eq!(
        bind(sg.clone(), "real-sealed-refused").await,
        Outcome::Invalid {
            field: "number".into()
        }
    );
    assert!(!sg.paths().iter().any(|path| path.ends_with("/payment")));
}

#[tokio::test]
async fn when_sealing_cannot_work_the_card_goes_the_plain_way() {
    for (name, jwk, sealed_status) in [
        ("real-sealed-outage", testkit::sealing_key(), 503),
        (
            "real-sealed-rsa",
            json!({"kty": "RSA", "n": "AQAB", "e": "AQAB"}),
            200,
        ),
    ] {
        let sg = FakeSg::sealing_with(SUCCEEDED, None, jwk, sealed_status);
        assert_eq!(
            bind(sg.clone(), name).await,
            Outcome::Succeeded { reason: None },
            "{name}"
        );
        let plain = sg
            .paths()
            .iter()
            .filter(|path| *path == "/cds/v1/tokenize/elements")
            .count();
        assert_eq!(plain, 3, "{name}");
        assert_eq!(
            payment_card(&sg)["number_hash"],
            "hash-card_number",
            "{name}"
        );
    }
}

#[tokio::test]
async fn an_old_runner_without_sealing_keeps_the_old_requests() {
    let script = format!("jwe_encrypt = nil\n{}", testkit::real("bind").script);
    let sg = FakeSg::sealing(REDIRECT);
    let outcome = testkit::session_with(&script, sg.clone(), "real-old-runner")
        .submit(testkit::card())
        .await
        .unwrap();
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
    assert_eq!(payment_card(&sg)["cardholder_name_hash"], "hash-cardholder");
    assert_eq!(
        bind_old(FakeSg::refusing("cardholder", 400), &script).await,
        Outcome::failed("tokenize_cardholder")
    );
}

async fn bind_old(sg: Arc<FakeSg>, script: &str) -> Outcome {
    testkit::session_with(script, sg, "real-old-holder")
        .submit(testkit::card())
        .await
        .unwrap()
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
        assert!(
            !body.contains("cardholder") && !body.contains("CARD HOLDER"),
            "{body}"
        );
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

async fn navigate(entry: &str, url: &str, name: &str) -> Option<Outcome> {
    let params = match entry {
        "bind" => testkit::bind_params(),
        "token" => testkit::yuno_params(),
        _ => json!({}),
    };
    open_real(
        entry,
        params,
        FakeSg::new(PENDING),
        &format!("{name}-{entry}"),
    )
    .navigate(url.into())
    .await
    .unwrap()
}

#[tokio::test]
async fn every_bundle_closes_the_window_on_a_boosty_finishing_page() {
    let done = Some(Outcome::Pending { reason: None });
    let failed = Some(Outcome::Pending {
        reason: Some("confirm_failed".into()),
    });
    for entry in ["bind", "token", "confirm"] {
        for (url, want) in [
            (
                "https://pay.boosty.to/app/payment/result?result=success",
                &done,
            ),
            (
                "https://pay.boosty.to/app/payment/result?result=fail",
                &failed,
            ),
            ("https://pay.boosty.to/app/payment/result", &done),
            ("https://boosty.to/", &done),
            ("https://boosty.to/app/settings/payments?tab=cards", &done),
            ("https://pay.boosty.to/app/payment/status/42", &done),
            ("https://PAY.Boosty.to/app/done", &done),
        ] {
            assert_eq!(
                &navigate(entry, url, "real-nav-end").await,
                want,
                "{entry} {url}"
            );
        }
    }
}

#[tokio::test]
async fn bank_payment_form_and_foreign_pages_keep_the_window_open() {
    for entry in ["bind", "token", "confirm"] {
        for url in [
            "https://acs.payeko.ru/3ds?id=1",
            "https://checkout.y.uno/payment?session=s1&3ds=true",
            "https://pay.boosty.to/new/payment/3ds",
            "https://pay.boosty.to/new/payment/binding?id=1",
            "https://pay.boosty.to/app/payment/3ds-check",
            "https://api-pay.boosty.to/payment/callback",
            "https://api.boosty.to/v1/x",
            "https://boosty.to.evil.example/app/payment/result?result=success",
            "https://evilboosty.to/",
            "https://boosty.to@evil.example/",
            "https://boosty.to:8443/",
            "http://pay.boosty.to/app/payment/result?result=success",
            "about:blank",
        ] {
            assert_eq!(
                navigate(entry, url, "real-nav-stay").await,
                None,
                "{entry} {url}"
            );
        }
    }
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
async fn the_confirm_bundle_has_no_form_and_ends_where_the_window_says() {
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
            PageEnd::Done(Outcome::Pending { reason: None })
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
