use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::sse::Frame;

const BROKEN: &str = "provider_failed";
const STAR: &str = "star_required";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChatEvent {
    Action { name: String, args: Value },
    Say { text: String },
    Done,
    Error { code: String },
    Cancelled,
}

#[derive(Deserialize)]
struct Action {
    name: String,
    #[serde(default)]
    args: Map<String, Value>,
}

#[derive(Deserialize)]
struct Say {
    text: String,
}

#[derive(Default, Deserialize)]
#[serde(default)]
struct Failure {
    code: String,
}

impl ChatEvent {
    pub fn decode(frame: &Frame) -> Option<ChatEvent> {
        match frame.event.as_str() {
            "action" => {
                let action: Action = serde_json::from_str(&frame.data).ok()?;
                Some(ChatEvent::Action {
                    name: action.name,
                    args: Value::Object(action.args),
                })
            }
            "say" => {
                let say: Say = serde_json::from_str(&frame.data).ok()?;
                (!say.text.is_empty()).then_some(ChatEvent::Say { text: say.text })
            }
            "done" => Some(ChatEvent::Done),
            "error" => {
                let failure: Failure = serde_json::from_str(&frame.data).unwrap_or_default();
                let code = Some(failure.code).filter(|code| !code.is_empty());
                Some(ChatEvent::Error {
                    code: code.unwrap_or_else(|| BROKEN.into()),
                })
            }
            _ => None,
        }
    }

    pub fn error(code: &str) -> ChatEvent {
        ChatEvent::Error { code: code.into() }
    }

    pub fn last(&self) -> bool {
        matches!(
            self,
            ChatEvent::Done | ChatEvent::Error { .. } | ChatEvent::Cancelled
        )
    }
}

pub fn refusal(status: u16, body: &[u8]) -> Option<&'static str> {
    let said: Value = serde_json::from_slice(body).ok()?;
    let named = |field: &str| said.get(field).and_then(Value::as_str);
    let code = named("code").or(named("error"))?;
    if code == STAR {
        return Some(STAR);
    }
    Some(match status {
        401 => "session",
        429 => "rate_limited",
        400..=499 => "bad_request",
        _ => "unavailable",
    })
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn decoded(event: &str, data: &str) -> Option<ChatEvent> {
        ChatEvent::decode(&Frame {
            event: event.into(),
            data: data.into(),
        })
    }

    #[test]
    fn stream_events_become_chat_events() {
        assert_eq!(
            decoded("action", r#"{"name":"volume_set","args":{"level":40}}"#),
            Some(ChatEvent::Action {
                name: "volume_set".into(),
                args: json!({"level": 40}),
            })
        );
        assert_eq!(
            decoded("say", r#"{"text":"Сделала потише"}"#),
            Some(ChatEvent::Say {
                text: "Сделала потише".into()
            })
        );
        assert_eq!(decoded("done", "{ }"), Some(ChatEvent::Done));
        assert_eq!(
            decoded("error", r#"{"code":"deadline"}"#),
            Some(ChatEvent::error("deadline"))
        );
    }

    #[test]
    fn an_action_without_args_gets_an_empty_object() {
        assert_eq!(
            decoded("action", r#"{"name":"pause"}"#),
            Some(ChatEvent::Action {
                name: "pause".into(),
                args: json!({}),
            })
        );
    }

    #[test]
    fn broken_and_unknown_events_are_skipped() {
        assert_eq!(decoded("action", r#"{"args":{}}"#), None);
        assert_eq!(decoded("action", r#"{"name":"x","args":[1]}"#), None);
        assert_eq!(decoded("say", "not json"), None);
        assert_eq!(decoded("say", r#"{"text":""}"#), None);
        assert_eq!(decoded("usage", r#"{"tokens":5}"#), None);
        assert_eq!(decoded("message", "{}"), None);
    }

    #[test]
    fn an_error_without_a_code_is_a_provider_failure() {
        assert_eq!(
            decoded("error", "{}"),
            Some(ChatEvent::error("provider_failed"))
        );
        assert_eq!(
            decoded("error", "oops"),
            Some(ChatEvent::error("provider_failed"))
        );
    }

    #[test]
    fn the_ui_gets_the_agreed_json() {
        let json = |event: ChatEvent| serde_json::to_value(event).unwrap();
        assert_eq!(
            json(ChatEvent::Action {
                name: "play".into(),
                args: json!({"query": "кино"}),
            }),
            json!({"kind": "action", "name": "play", "args": {"query": "кино"}})
        );
        assert_eq!(
            json(ChatEvent::Say {
                text: "да".into()
            }),
            json!({"kind": "say", "text": "да"})
        );
        assert_eq!(json(ChatEvent::Done), json!({"kind": "done"}));
        assert_eq!(
            json(ChatEvent::error("deadline")),
            json!({"kind": "error", "code": "deadline"})
        );
        assert_eq!(json(ChatEvent::Cancelled), json!({"kind": "cancelled"}));
    }

    fn api(status: u16, code: Option<&str>) -> Vec<u8> {
        let mut said = json!({"statusCode": status, "message": "why", "error": "Reason"});
        if let Some(code) = code {
            said["code"] = json!(code);
        }
        said.to_string().into_bytes()
    }

    #[test]
    fn the_api_refuses_with_its_error_body() {
        let coded = |status, code| refusal(status, &api(status, Some(code)));
        let plain = |status| refusal(status, &api(status, None));
        assert_eq!(coded(403, "star_required"), Some("star_required"));
        assert_eq!(
            refusal(403, br#"{"error":"star_required"}"#),
            Some("star_required")
        );
        assert_eq!(plain(401), Some("session"));
        assert_eq!(coded(429, "voice_chat_limited"), Some("rate_limited"));
        assert_eq!(coded(400, "voice_chat_invalid"), Some("bad_request"));
        assert_eq!(plain(413), Some("bad_request"));
        assert_eq!(plain(403), Some("bad_request"));
        assert_eq!(coded(503, "voice_busy"), Some("unavailable"));
        assert_eq!(plain(500), Some("unavailable"));
    }

    #[test]
    fn an_answer_without_the_api_error_body_is_not_a_refusal() {
        let pages: [&[u8]; 6] = [
            b"",
            b"<html><body>403 Forbidden</body></html>",
            b"Forbidden",
            b"{}",
            br#"{"error":{"code":1020}}"#,
            br#"["star_required"]"#,
        ];
        for page in pages {
            for status in [401, 403, 429, 502, 503] {
                assert_eq!(refusal(status, page), None, "{status}");
            }
        }
    }
}
