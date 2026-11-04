use http::{Method, Response, StatusCode};
use sc_chat::ChatError;
use tauri::Manager;
use uuid::Uuid;

use super::download::{self, Fetched, MediaKey, Variant};
use super::state::ChatState;
use crate::rt::AppHandle;

pub const SCHEME: &str = "chatmedia";
const KEEP: &str = "private, max-age=86400";
const NO_STORE: &str = "no-store";

pub async fn handle(app: &AppHandle, request: http::Request<Vec<u8>>) -> Response<Vec<u8>> {
    if request.method() != Method::GET && request.method() != Method::HEAD {
        return refused(StatusCode::METHOD_NOT_ALLOWED);
    }
    let Some(key) = parse(request.uri().path()) else {
        return refused(StatusCode::BAD_REQUEST);
    };
    let Some(state) = app.try_state::<ChatState>() else {
        return refused(StatusCode::SERVICE_UNAVAILABLE);
    };
    answer(download::load(&state, &key).await)
}

pub fn parse(path: &str) -> Option<MediaKey> {
    let mut parts = path.strip_prefix('/')?.split('/');
    let conversation_id = uuid(parts.next()?)?;
    let media_id = uuid(parts.next()?)?;
    let variant = Variant::parse(parts.next()?)?;
    if parts.next().is_some() {
        return None;
    }
    Some(MediaKey {
        conversation_id,
        media_id,
        variant,
    })
}

pub fn answer(loaded: Result<Fetched, ChatError>) -> Response<Vec<u8>> {
    match loaded {
        Ok(Fetched::Image(picture)) => Response::builder()
            .status(StatusCode::OK)
            .header("content-type", picture.mime)
            .header("cache-control", KEEP)
            .header("access-control-allow-origin", "*")
            .body(picture.bytes)
            .unwrap_or_else(|_| refused(StatusCode::INTERNAL_SERVER_ERROR)),
        Ok(Fetched::Deleted) => refused(StatusCode::GONE),
        Ok(Fetched::Lost) | Err(ChatError::NotFound) => refused(StatusCode::NOT_FOUND),
        Err(ChatError::Invalid) => refused(StatusCode::BAD_REQUEST),
        Err(
            ChatError::NotReady
            | ChatError::Store
            | ChatError::Keychain
            | ChatError::ReloginRequired
            | ChatError::DeviceRevoked
            | ChatError::Disabled,
        ) => refused(StatusCode::SERVICE_UNAVAILABLE),
        Err(_) => refused(StatusCode::BAD_GATEWAY),
    }
}

fn uuid(raw: &str) -> Option<Uuid> {
    let canonical = raw.len() == 36
        && raw
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit() || byte == b'-');
    canonical.then(|| Uuid::parse_str(raw).ok()).flatten()
}

fn refused(status: StatusCode) -> Response<Vec<u8>> {
    let mut response = Response::new(Vec::new());
    *response.status_mut() = status;
    response.headers_mut().insert(
        http::header::CACHE_CONTROL,
        http::HeaderValue::from_static(NO_STORE),
    );
    response
}

#[cfg(test)]
mod tests;
