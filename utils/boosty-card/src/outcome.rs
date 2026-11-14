use serde::{Deserialize, Serialize};

use crate::guard;

const REASON_LEN: usize = 48;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum State {
    Pending,
    Redirect,
    Succeeded,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Outcome {
    pub state: State,
    pub url: Option<String>,
    pub status: Option<u16>,
    pub reason: Option<String>,
    #[serde(skip)]
    pub step_ok: bool,
}

#[derive(Deserialize)]
pub(crate) struct Reply {
    ok: Option<bool>,
    state: Option<String>,
    url: Option<String>,
    status: Option<u16>,
    reason: Option<String>,
}

impl Outcome {
    pub fn failed(reason: &str) -> Self {
        Self {
            state: State::Failed,
            url: None,
            status: None,
            reason: Some(reason.to_string()),
            step_ok: true,
        }
    }
}

impl From<Reply> for Outcome {
    fn from(reply: Reply) -> Self {
        let reason = reply.reason.as_deref().map(code);
        let step_ok = reply.ok != Some(false);
        let failed = |reason: Option<String>| Outcome {
            state: State::Failed,
            url: None,
            status: reply.status,
            reason: reason.or_else(|| Some("unknown".into())),
            step_ok,
        };
        if !step_ok {
            return failed(reason);
        }
        let state = match reply.state.as_deref() {
            Some("pending") | None => State::Pending,
            Some("redirect") => State::Redirect,
            Some("succeeded") => State::Succeeded,
            Some("failed") => State::Failed,
            Some(_) => return failed(Some("bad_state".into())),
        };
        if state == State::Failed {
            return failed(reason);
        }
        if state == State::Redirect && !reply.url.as_deref().is_some_and(guard::acceptable_page) {
            return failed(Some("bad_redirect".into()));
        }
        Outcome {
            state,
            url: reply.url.filter(|_| state == State::Redirect),
            status: reply.status,
            reason,
            step_ok,
        }
    }
}

pub(crate) fn code(raw: &str) -> String {
    let kept: String = raw
        .chars()
        .filter(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || *c == '_')
        .take(REASON_LEN)
        .collect();
    if kept.is_empty() {
        "unknown".into()
    } else {
        kept
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn outcome(json: &str) -> Outcome {
        serde_json::from_str::<Reply>(json).unwrap().into()
    }

    #[test]
    fn a_redirect_keeps_its_bank_url() {
        let done = outcome(
            r#"{"ok":true,"state":"redirect","url":"https://acs.payeko.ru/3ds","status":200}"#,
        );
        assert_eq!(done.state, State::Redirect);
        assert_eq!(done.url.as_deref(), Some("https://acs.payeko.ru/3ds"));
    }

    #[test]
    fn a_redirect_to_a_bad_page_is_a_failure() {
        for url in ["http://acs.payeko.ru/", "https://10.0.0.1/", "javascript:1"] {
            let done = outcome(&format!(
                r#"{{"ok":true,"state":"redirect","url":"{url}"}}"#
            ));
            assert_eq!(done.state, State::Failed, "{url}");
            assert_eq!(done.reason.as_deref(), Some("bad_redirect"));
        }
        assert_eq!(
            outcome(r#"{"ok":true,"state":"redirect"}"#).state,
            State::Failed
        );
    }

    #[test]
    fn not_ok_is_a_failure_with_a_clean_reason() {
        let done = outcome(r#"{"ok":false,"reason":"tokenize_cvv","status":422}"#);
        assert_eq!(done.state, State::Failed);
        assert!(!done.step_ok);
        assert_eq!(done.reason.as_deref(), Some("tokenize_cvv"));
        assert_eq!(done.status, Some(422));
        let done = outcome(r#"{"ok":false,"reason":"Card 4242 declined!"}"#);
        assert_eq!(done.reason.as_deref(), Some("ard4242declined"));
        assert_eq!(
            outcome(r#"{"ok":false}"#).reason.as_deref(),
            Some("unknown")
        );
    }

    #[test]
    fn plain_states_map_and_the_response_blob_is_dropped() {
        assert_eq!(
            outcome(r#"{"ok":true,"state":"succeeded","response":{"card":"x"}}"#).state,
            State::Succeeded
        );
        assert_eq!(
            outcome(r#"{"ok":true,"state":"pending"}"#).state,
            State::Pending
        );
        assert_eq!(outcome(r#"{"ok":true}"#).state, State::Pending);
        let failed = outcome(r#"{"ok":true,"state":"failed","reason":"cancelled"}"#);
        assert_eq!(
            (failed.state, failed.reason.as_deref()),
            (State::Failed, Some("cancelled"))
        );
        assert_eq!(
            outcome(r#"{"ok":true,"state":"weird"}"#).reason.as_deref(),
            Some("bad_state")
        );
    }
}
