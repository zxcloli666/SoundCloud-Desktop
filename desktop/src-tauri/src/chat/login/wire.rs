use sc_chat::channel::InnerAnswer;
use sc_chat::{
    ChatError, ChatResult, LinkMode, LinkPoll, LinkState, LoginPoll, LoginState, LoginStep, Millis,
};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::Value;

const RETRY_DEFAULT_MS: u64 = 1_000;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LoginStatus {
    status: String,
    step: Option<String>,
    session_id: Option<String>,
    username: Option<String>,
    error: Option<String>,
    redirect_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkStatus {
    status: String,
    mode: LinkMode,
    session_id: Option<String>,
    error: Option<String>,
}

pub fn decode<T: DeserializeOwned>(answer: &InnerAnswer) -> ChatResult<T> {
    if !succeeded(answer) {
        return Err(rejection(answer));
    }
    serde_json::from_slice(&answer.body).map_err(|_| ChatError::Protocol)
}

pub fn login_poll(answer: &InnerAnswer) -> ChatResult<LoginPoll> {
    let polled: LoginStatus = decode(answer)?;
    Ok(LoginPoll {
        status: match polled.status.as_str() {
            "completed" => LoginState::Completed,
            "failed" => LoginState::Failed,
            "expired" => LoginState::Expired,
            _ => LoginState::Pending,
        },
        step: match polled.step.as_deref() {
            Some("token") => Some(LoginStep::Token),
            Some("extract") => Some(LoginStep::Extract),
            Some("finalizing") => Some(LoginStep::Finalizing),
            _ => None,
        },
        session_id: polled.session_id,
        username: polled.username,
        error: polled.error,
        redirect_url: polled.redirect_url,
    })
}

pub fn link_poll(answer: &InnerAnswer) -> ChatResult<LinkPoll> {
    let polled: LinkStatus = decode(answer)?;
    Ok(LinkPoll {
        status: match polled.status.as_str() {
            "claimed" => LinkState::Claimed,
            "failed" => LinkState::Failed,
            "expired" => LinkState::Expired,
            _ => LinkState::Pending,
        },
        mode: polled.mode,
        session_id: polled.session_id,
        error: polled.error,
    })
}

pub fn server_now(answer: &InnerAnswer) -> Option<Millis> {
    if succeeded(answer) {
        return None;
    }
    match rejection(answer) {
        ChatError::Clock { server_now } if server_now > 0 => Some(server_now),
        _ => None,
    }
}

fn succeeded(answer: &InnerAnswer) -> bool {
    (200..300).contains(&answer.status)
}

fn rejection(answer: &InnerAnswer) -> ChatError {
    let body: Value = serde_json::from_slice(&answer.body).unwrap_or(Value::Null);
    let from_chat = body
        .get("error")
        .and_then(Value::as_str)
        .is_some_and(|code| code.starts_with("chat_"));
    if from_chat {
        return ChatError::from_server(&body);
    }
    match answer.status {
        429 | 503 => ChatError::Busy {
            retry_ms: retry_after_ms(answer),
        },
        404 => ChatError::NotFound,
        400..=499 => ChatError::Invalid,
        _ => ChatError::Internal,
    }
}

fn retry_after_ms(answer: &InnerAnswer) -> u64 {
    answer
        .headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("retry-after"))
        .and_then(|(_, value)| value.trim().parse::<u64>().ok())
        .map_or(RETRY_DEFAULT_MS, |seconds| seconds.saturating_mul(1_000))
}
