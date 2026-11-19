use serde::{Deserialize, Serialize};

use crate::guard;

const REASON_LEN: usize = 48;
const TOKEN_LEN: usize = 200;
const FIELDS: [&str; 3] = ["number", "expiry", "cvv"];

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum Outcome {
    Invalid {
        field: String,
    },
    Failed {
        reason: String,
    },
    Page {
        page_url: String,
    },
    Token {
        token: String,
    },
    Succeeded {
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    Pending {
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
}

#[derive(Deserialize)]
pub(crate) struct Reply {
    state: Option<String>,
    field: Option<String>,
    reason: Option<String>,
    page_url: Option<String>,
    token: Option<String>,
}

impl Outcome {
    pub fn failed(reason: &str) -> Self {
        Outcome::Failed {
            reason: reason.to_string(),
        }
    }

    pub(crate) fn on_page(reply: Reply) -> Option<Self> {
        match reply.state.as_deref() {
            Some("page") => None,
            Some("succeeded" | "pending" | "failed") => Some(Outcome::read(reply, &[])),
            _ => Some(Outcome::failed("bad_state")),
        }
    }

    pub(crate) fn read(reply: Reply, page_hosts: &[String]) -> Self {
        let reason = reply.reason.as_deref().map(code);
        match reply.state.as_deref() {
            Some("invalid") => match reply.field.as_deref() {
                Some(field) if FIELDS.contains(&field) => Outcome::Invalid {
                    field: field.into(),
                },
                _ => Outcome::failed("bad_field"),
            },
            Some("failed") => Outcome::Failed {
                reason: reason.unwrap_or_else(|| "unknown".into()),
            },
            Some("page") => match reply.page_url {
                Some(url) if guard::page_on(&url, page_hosts) => Outcome::Page { page_url: url },
                _ => Outcome::failed("bad_page"),
            },
            Some("token") => match reply.token.filter(|token| clean_token(token)) {
                Some(token) => Outcome::Token { token },
                None => Outcome::failed("bad_token"),
            },
            Some("succeeded") => Outcome::Succeeded { reason },
            Some("pending") => Outcome::Pending { reason },
            _ => Outcome::failed("bad_state"),
        }
    }
}

fn clean_token(token: &str) -> bool {
    !token.is_empty()
        && token.len() <= TOKEN_LEN
        && token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b':'))
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

    fn read(json: &str, pages: &[&str]) -> Outcome {
        let pages: Vec<String> = pages.iter().map(|host| host.to_string()).collect();
        Outcome::read(serde_json::from_str(json).unwrap(), &pages)
    }

    #[test]
    fn each_state_maps_to_its_outcome() {
        assert_eq!(
            read(r#"{"state":"invalid","field":"cvv"}"#, &[]),
            Outcome::Invalid {
                field: "cvv".into()
            }
        );
        assert_eq!(
            read(r#"{"state":"failed","reason":"do_not_honor"}"#, &[]),
            Outcome::failed("do_not_honor")
        );
        assert_eq!(
            read(
                r#"{"state":"page","page_url":"https://acs.bank.example/3ds"}"#,
                &[]
            ),
            Outcome::Page {
                page_url: "https://acs.bank.example/3ds".into()
            }
        );
        assert_eq!(
            read(r#"{"state":"token","token":"tok-1"}"#, &[]),
            Outcome::Token {
                token: "tok-1".into()
            }
        );
        assert_eq!(
            read(r#"{"state":"succeeded"}"#, &[]),
            Outcome::Succeeded { reason: None }
        );
        assert_eq!(
            read(r#"{"state":"pending","reason":"confirm_failed"}"#, &[]),
            Outcome::Pending {
                reason: Some("confirm_failed".into())
            }
        );
    }

    #[test]
    fn anything_off_contract_is_a_failure() {
        for (json, reason) in [
            (r#"{"state":"invalid","field":"name"}"#, "bad_field"),
            (r#"{"state":"invalid"}"#, "bad_field"),
            (
                r#"{"state":"page","page_url":"http://acs.bank.example/"}"#,
                "bad_page",
            ),
            (r#"{"state":"page"}"#, "bad_page"),
            (r#"{"state":"token","token":"bad token\n"}"#, "bad_token"),
            (r#"{"state":"token"}"#, "bad_token"),
            (r#"{"state":"redirect"}"#, "bad_state"),
            (r#"{}"#, "bad_state"),
            (r#"{"state":"failed"}"#, "unknown"),
        ] {
            assert_eq!(read(json, &[]), Outcome::failed(reason), "{json}");
        }
        let long = format!(r#"{{"state":"token","token":"{}"}}"#, "x".repeat(201));
        assert_eq!(read(&long, &[]), Outcome::failed("bad_token"));
    }

    #[test]
    fn a_page_off_the_bundle_page_hosts_is_refused() {
        let off = read(
            r#"{"state":"page","page_url":"https://evil.example/3ds"}"#,
            &["y.uno"],
        );
        assert_eq!(off, Outcome::failed("bad_page"));
        let on = read(
            r#"{"state":"page","page_url":"https://checkout.y.uno/3ds"}"#,
            &["y.uno"],
        );
        assert!(matches!(on, Outcome::Page { .. }));
    }

    #[test]
    fn reasons_are_cut_to_a_clean_code() {
        assert_eq!(
            read(r#"{"state":"failed","reason":"Card 4242 declined!"}"#, &[]),
            Outcome::failed("ard4242declined")
        );
    }

    #[test]
    fn outcomes_serialize_flat_for_the_front() {
        let shown = |outcome: Outcome| serde_json::to_string(&outcome).unwrap();
        assert_eq!(
            shown(Outcome::Invalid {
                field: "number".into()
            }),
            r#"{"state":"invalid","field":"number"}"#
        );
        assert_eq!(
            shown(Outcome::Pending { reason: None }),
            r#"{"state":"pending"}"#
        );
        assert_eq!(
            shown(Outcome::Token { token: "t".into() }),
            r#"{"state":"token","token":"t"}"#
        );
    }
}
