use std::pin::pin;
use std::time::Duration;

use serde::Serialize;
use tokio::time::{Instant, sleep, timeout};

use crate::card::Card;
use crate::outcome::{Outcome, State};
use crate::sandbox::RunError;
use crate::session::Session;

const STATUS_ERRORS_IN_A_ROW: u32 = 5;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Sending,
    Confirm,
    Checking,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Confirmed {
    Success,
    Failure,
    Closed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum Verdict {
    Succeeded,
    Failed { reason: String },
    Invalid { field: String },
    Tokenized { token: String },
    Timeout,
}

pub struct Pace {
    pub status_every: Duration,
    pub status_for: Duration,
    pub watch_every: Duration,
    pub confirm_for: Duration,
    pub after_close: Duration,
}

impl Default for Pace {
    fn default() -> Self {
        Self {
            status_every: Duration::from_secs(2),
            status_for: Duration::from_secs(90),
            watch_every: Duration::from_secs(4),
            confirm_for: Duration::from_secs(8 * 60),
            after_close: Duration::from_secs(8),
        }
    }
}

pub async fn submit(
    session: &Session,
    card: Card,
    pace: &Pace,
    confirm: impl AsyncFnOnce(String) -> Confirmed,
    phase: impl Fn(Phase),
) -> Verdict {
    phase(Phase::Sending);
    let first = match session.bind(card).await {
        Ok(outcome) => outcome,
        Err(error) => return failed(error.code()),
    };
    match first.state {
        State::Succeeded => Verdict::Succeeded,
        State::Failed => refused_field(&first).unwrap_or_else(|| verdict_of(&first)),
        State::Pending => poll(session, pace.status_for, pace, &phase).await,
        State::Redirect => {
            phase(Phase::Confirm);
            let url = first.url.unwrap_or_default();
            match watch_window(session, pace, confirm(url)).await {
                Watched::Settled(verdict) => verdict,
                Watched::Ended(Confirmed::Closed) => {
                    match poll(session, pace.after_close, pace, &phase).await {
                        Verdict::Timeout => failed("closed"),
                        verdict => verdict,
                    }
                }
                Watched::Ended(_) => poll(session, pace.status_for, pace, &phase).await,
            }
        }
    }
}

enum Watched {
    Settled(Verdict),
    Ended(Confirmed),
}

async fn watch_window(
    session: &Session,
    pace: &Pace,
    window: impl Future<Output = Confirmed>,
) -> Watched {
    let mut window = pin!(timeout(pace.confirm_for, window));
    loop {
        tokio::select! {
            ended = &mut window => return Watched::Ended(ended.unwrap_or(Confirmed::Closed)),
            _ = sleep(pace.watch_every) => {
                if let Ok(outcome) = session.status().await
                    && outcome.step_ok
                    && matches!(outcome.state, State::Succeeded | State::Failed)
                {
                    return Watched::Settled(verdict_of(&outcome));
                }
            }
        }
    }
}

async fn poll(session: &Session, budget: Duration, pace: &Pace, phase: &impl Fn(Phase)) -> Verdict {
    phase(Phase::Checking);
    let until = Instant::now() + budget;
    let mut errors = 0;
    loop {
        match session.status().await {
            Ok(outcome) if outcome.step_ok => {
                errors = 0;
                if matches!(outcome.state, State::Succeeded | State::Failed) {
                    return verdict_of(&outcome);
                }
            }
            Ok(_) | Err(RunError::Script(_) | RunError::Sandbox(_)) => errors += 1,
            Err(denied) => return failed(denied.code()),
        }
        if errors >= STATUS_ERRORS_IN_A_ROW {
            return failed("status");
        }
        if Instant::now() >= until {
            return Verdict::Timeout;
        }
        sleep(pace.status_every).await;
    }
}

fn refused_field(outcome: &Outcome) -> Option<Verdict> {
    let field = match outcome.reason.as_deref()? {
        "tokenize_card_number" => "number",
        "tokenize_expire_date" | "expiry_format" => "expiry",
        "tokenize_cvv" => "cvv",
        _ => return None,
    };
    let bad_input = match outcome.status {
        None => true,
        Some(code) => (400..500).contains(&code) && code != 408 && code != 429,
    };
    bad_input.then(|| Verdict::Invalid {
        field: field.into(),
    })
}

fn verdict_of(outcome: &Outcome) -> Verdict {
    match outcome.state {
        State::Succeeded => Verdict::Succeeded,
        _ => failed(outcome.reason.as_deref().unwrap_or("unknown")),
    }
}

fn failed(reason: &str) -> Verdict {
    Verdict::Failed {
        reason: reason.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::{Arc, Mutex};

    use super::*;
    use crate::testkit::{
        self, CANCELLED_BARE, CANCELLED_NO_PAYMENT, CAPTURE_TIMEOUT, FAILED, FakeSg, NUMBER,
        PENDING, REDIRECT, REDIRECT_GET, REDIRECT_POST, SUCCEEDED,
    };

    fn pace() -> Pace {
        Pace {
            status_every: Duration::from_millis(5),
            status_for: Duration::from_millis(400),
            watch_every: Duration::from_millis(15),
            confirm_for: Duration::from_millis(600),
            after_close: Duration::from_millis(60),
        }
    }

    struct Window {
        urls: Mutex<Vec<String>>,
        dropped: AtomicBool,
    }

    struct CloseOnDrop(Arc<Window>);

    impl Drop for CloseOnDrop {
        fn drop(&mut self) {
            self.0.dropped.store(true, Ordering::SeqCst);
        }
    }

    async fn drive(
        sg: Arc<FakeSg>,
        name: &str,
        ends: Option<Confirmed>,
    ) -> (Verdict, Vec<Phase>, Arc<Window>) {
        let session = testkit::session(sg, name);
        let window = Arc::new(Window {
            urls: Mutex::new(vec![]),
            dropped: AtomicBool::new(false),
        });
        let phases = Mutex::new(vec![]);
        let shown = window.clone();
        let verdict = submit(
            &session,
            testkit::card(),
            &pace(),
            async move |url: String| {
                shown.urls.lock().unwrap().push(url);
                let _guard = CloseOnDrop(shown.clone());
                match ends {
                    Some(end) => {
                        sleep(Duration::from_millis(20)).await;
                        end
                    }
                    None => std::future::pending().await,
                }
            },
            |phase| phases.lock().unwrap().push(phase),
        )
        .await;
        let phases = phases.into_inner().unwrap();
        (verdict, phases, window)
    }

    #[tokio::test]
    async fn a_card_without_3ds_is_linked_straight_away() {
        let sg = FakeSg::new(SUCCEEDED, &[]);
        let (verdict, phases, window) = drive(sg, "flow-direct", None).await;
        assert_eq!(verdict, Verdict::Succeeded);
        assert_eq!(phases, [Phase::Sending]);
        assert!(window.urls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_3ds_card_opens_the_bank_page_then_polls_until_succeeded() {
        let sg = FakeSg::new(REDIRECT, &[REDIRECT, REDIRECT, SUCCEEDED]);
        let (verdict, phases, window) =
            drive(sg.clone(), "flow-3ds", Some(Confirmed::Success)).await;
        assert_eq!(verdict, Verdict::Succeeded);
        assert_eq!(phases, [Phase::Sending, Phase::Confirm, Phase::Checking]);
        assert_eq!(
            window.urls.lock().unwrap().as_slice(),
            ["https://acs.payeko.ru/3ds?id=1"]
        );
        assert!(sg.status_calls() >= 1);
    }

    #[tokio::test]
    async fn a_declined_3ds_ends_failed_with_the_banks_reason() {
        let sg = FakeSg::new(REDIRECT, &[FAILED]);
        let (verdict, _, _) = drive(sg, "flow-declined", Some(Confirmed::Failure)).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "failed".into()
            }
        );
    }

    #[tokio::test]
    async fn closing_the_window_without_a_result_fails_after_a_last_look() {
        let sg = FakeSg::new(REDIRECT, &[REDIRECT]);
        let (verdict, _, _) = drive(sg, "flow-closed", Some(Confirmed::Closed)).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "closed".into()
            }
        );
    }

    #[tokio::test]
    async fn closing_the_window_after_paying_still_finds_the_result() {
        let sg = FakeSg::new(REDIRECT, &[REDIRECT, SUCCEEDED]);
        let (verdict, _, _) = drive(sg, "flow-closed-late", Some(Confirmed::Closed)).await;
        assert_eq!(verdict, Verdict::Succeeded);
    }

    #[tokio::test]
    async fn a_result_found_while_the_window_is_open_closes_it() {
        let sg = FakeSg::new(REDIRECT, &[REDIRECT, SUCCEEDED]);
        let (verdict, phases, window) = drive(sg, "flow-watch", None).await;
        assert_eq!(verdict, Verdict::Succeeded);
        assert_eq!(phases, [Phase::Sending, Phase::Confirm]);
        assert!(window.dropped.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn an_endless_window_is_closed_after_its_budget() {
        let sg = FakeSg::new(REDIRECT, &[REDIRECT]);
        let started = Instant::now();
        let (verdict, _, window) = drive(sg, "flow-endless", None).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "closed".into()
            }
        );
        assert!(started.elapsed() < Duration::from_secs(3));
        assert!(window.dropped.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn polling_gives_up_with_a_timeout() {
        let sg = FakeSg::new(testkit::PENDING, &[PENDING]);
        let (verdict, phases, _) = drive(sg, "flow-timeout", None).await;
        assert_eq!(verdict, Verdict::Timeout);
        assert_eq!(phases, [Phase::Sending, Phase::Checking]);
    }

    #[tokio::test]
    async fn a_bank_failure_on_bind_stops_at_once_without_polling() {
        let sg = FakeSg::with_codes("{}", 422, &[]);
        let (verdict, phases, _) = drive(sg.clone(), "flow-bind-fails", None).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "payment".into()
            }
        );
        assert_eq!(phases, [Phase::Sending]);
        assert_eq!(sg.status_calls(), 0);
    }

    #[tokio::test]
    async fn an_abandoned_3ds_ends_with_the_gateways_own_code_and_never_its_text() {
        for last in [CAPTURE_TIMEOUT, CANCELLED_NO_PAYMENT] {
            let sg = FakeSg::new(REDIRECT, &[REDIRECT, last]);
            let (verdict, _, _) = drive(sg, "flow-abandoned", Some(Confirmed::Closed)).await;
            assert_eq!(
                verdict,
                Verdict::Failed {
                    reason: "capture_timeout".into()
                }
            );
            assert!(
                !serde_json::to_string(&verdict)
                    .unwrap()
                    .contains("confirmation timeout")
            );
        }
    }

    #[tokio::test]
    async fn a_cancelled_session_without_a_code_fails_with_its_status() {
        let sg = FakeSg::new(REDIRECT, &[REDIRECT, CANCELLED_BARE]);
        let (verdict, _, _) = drive(sg, "flow-cancelled", Some(Confirmed::Closed)).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "cancelled".into()
            }
        );
    }

    #[tokio::test]
    async fn a_bank_page_that_wants_a_post_fails_without_opening_a_window() {
        let sg = FakeSg::new(REDIRECT_POST, &[]);
        let (verdict, phases, window) = drive(sg.clone(), "flow-post", None).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "redirect_method".into()
            }
        );
        assert_eq!(phases, [Phase::Sending]);
        assert!(window.urls.lock().unwrap().is_empty());
        assert_eq!(sg.status_calls(), 0);
    }

    #[tokio::test]
    async fn a_get_bank_page_opens_with_its_full_url() {
        let sg = FakeSg::new(REDIRECT_GET, &[SUCCEEDED]);
        let (verdict, _, window) = drive(sg, "flow-get", Some(Confirmed::Success)).await;
        assert_eq!(verdict, Verdict::Succeeded);
        assert_eq!(
            window.urls.lock().unwrap().as_slice(),
            ["https://acs.payeko.ru/3ds?mdOrder=1"]
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
            let (verdict, phases, window) = drive(sg.clone(), "flow-refused", None).await;
            assert_eq!(
                verdict,
                Verdict::Invalid {
                    field: field.into()
                }
            );
            assert_eq!(phases, [Phase::Sending]);
            assert!(window.urls.lock().unwrap().is_empty());
            assert!(!sg.paths().iter().any(|path| path.ends_with("/payment")));
            assert_eq!(sg.status_calls(), 0);
        }
    }

    #[tokio::test]
    async fn a_refused_fixed_holder_is_a_failure_not_a_form_field() {
        let sg = FakeSg::refusing("cardholder", 400);
        let (verdict, _, window) = drive(sg, "flow-holder", None).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "tokenize_cardholder".into()
            }
        );
        assert!(window.urls.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn a_gateway_outage_on_tokenize_is_a_failure_not_a_bad_field() {
        for status in [429, 500, 503] {
            let sg = FakeSg::refusing("card_number", status);
            let (verdict, _, _) = drive(sg, "flow-outage", None).await;
            assert_eq!(
                verdict,
                Verdict::Failed {
                    reason: "tokenize_card_number".into()
                }
            );
        }
    }

    #[tokio::test]
    async fn the_session_stays_usable_for_another_try_after_a_refusal() {
        let refusing = FakeSg::refusing("card_number", 400);
        let session = testkit::session(refusing.clone(), "flow-retry");
        let phase = |_: Phase| {};
        let first = submit(
            &session,
            testkit::card(),
            &pace(),
            async |_: String| Confirmed::Success,
            phase,
        )
        .await;
        assert!(matches!(first, Verdict::Invalid { .. }));
        let again = submit(
            &session,
            testkit::card(),
            &pace(),
            async |_: String| Confirmed::Success,
            phase,
        )
        .await;
        assert!(matches!(again, Verdict::Invalid { .. }));
        let inits = refusing
            .paths()
            .iter()
            .filter(|path| path.ends_with("/init"))
            .count();
        assert_eq!(inits, 2);
    }

    #[test]
    fn a_local_expiry_format_error_is_a_form_field_too() {
        let outcome = Outcome::failed("expiry_format");
        assert_eq!(
            refused_field(&outcome),
            Some(Verdict::Invalid {
                field: "expiry".into()
            })
        );
        assert_eq!(refused_field(&Outcome::failed("payment")), None);
    }

    #[test]
    fn the_invalid_verdict_serializes_for_the_front() {
        let verdict = Verdict::Invalid {
            field: "number".into(),
        };
        assert_eq!(
            serde_json::to_string(&verdict).unwrap(),
            r#"{"state":"invalid","field":"number"}"#
        );
    }

    #[tokio::test]
    async fn a_hiccup_in_the_status_endpoint_is_not_the_end() {
        let sg = FakeSg::with_codes(PENDING, 200, &[(502, "{}"), (502, "{}"), (200, SUCCEEDED)]);
        let (verdict, _, _) = drive(sg, "flow-hiccup", None).await;
        assert_eq!(verdict, Verdict::Succeeded);
    }

    #[tokio::test]
    async fn a_dead_status_endpoint_fails_after_a_few_tries() {
        let sg = FakeSg::with_codes(PENDING, 200, &[(500, "{}")]);
        let (verdict, _, _) = drive(sg.clone(), "flow-dead", None).await;
        assert_eq!(
            verdict,
            Verdict::Failed {
                reason: "status".into()
            }
        );
        assert_eq!(sg.status_calls(), STATUS_ERRORS_IN_A_ROW as usize);
    }

    #[tokio::test]
    async fn the_verdict_carries_no_card_data() {
        let sg = FakeSg::new(REDIRECT, &[SUCCEEDED]);
        let (verdict, phases, window) = drive(sg, "flow-clean", Some(Confirmed::Success)).await;
        let text = format!(
            "{}{phases:?}{:?}",
            serde_json::to_string(&verdict).unwrap(),
            window.urls.lock().unwrap()
        );
        assert!(!text.contains(NUMBER) && !text.contains(testkit::CVV));
    }
}
