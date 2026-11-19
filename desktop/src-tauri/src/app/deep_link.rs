use std::sync::Mutex;
use std::time::{Duration, Instant};

use sc_deep_link::AuthCallback;
use serde::Serialize;
use tauri::{Emitter, Manager, Url};
use tauri_plugin_deep_link::DeepLinkExt;

use crate::app::{diagnostics, visibility};
use crate::rt::AppHandle;

const EVENT: &str = "mobile-link:callback";
const WINDOW: &str = "main";

const PENDING_TTL: Duration = Duration::from_secs(15 * 60);

#[derive(Default)]
struct Slots {
    last_state: Option<String>,
    pending: Option<(Payload, Instant)>,
}

#[derive(Default)]
pub struct Inbox(Mutex<Slots>);

impl Inbox {
    fn accept(&self, payload: &Payload, at: Instant) -> bool {
        let mut slots = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if slots.last_state.as_deref() == Some(payload.state.as_str()) {
            return false;
        }
        slots.last_state = Some(payload.state.clone());
        slots.pending = Some((payload.clone(), at));
        true
    }

    fn take(&self, now: Instant) -> Option<Payload> {
        let mut slots = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let (payload, at) = slots.pending.take()?;
        (now.saturating_duration_since(at) <= PENDING_TTL).then_some(payload)
    }
}

#[derive(Clone, Serialize)]
pub struct Payload {
    code: String,
    state: String,
}

impl From<AuthCallback> for Payload {
    fn from(callback: AuthCallback) -> Self {
        Self {
            code: callback.code,
            state: callback.state,
        }
    }
}

pub fn attach(app: &AppHandle) {
    app.manage(Inbox::default());
    let links = app.deep_link();
    let handler = app.clone();
    links.on_open_url(move |event| receive(&handler, event.urls()));
    if let Ok(Some(urls)) = links.get_current() {
        receive(app, urls);
    }
    #[cfg(windows)]
    if let Err(e) = links.register_all() {
        diagnostics::warn(format!("[DeepLink] register failed: {e}"));
    }
}

fn receive(app: &AppHandle, urls: Vec<Url>) {
    for url in urls {
        match sc_deep_link::parse_auth(url.as_str()) {
            Ok(callback) => forward(app, callback.into()),
            Err(e) => diagnostics::warn(format!("[DeepLink] ignored: {e}")),
        }
    }
}

fn forward(app: &AppHandle, payload: Payload) {
    if !app.state::<Inbox>().accept(&payload, Instant::now()) {
        return;
    }
    visibility::show_main(app);
    if let Err(e) = app.emit_to(WINDOW, EVENT, payload) {
        diagnostics::warn(format!("[DeepLink] emit failed: {e}"));
    }
}

#[tauri::command]
pub fn deep_link_take_pending(inbox: tauri::State<'_, Inbox>) -> Option<Payload> {
    inbox.take(Instant::now())
}

#[tauri::command]
pub fn deep_link_parse(url: String) -> Result<Payload, String> {
    sc_deep_link::parse_auth(&url)
        .map(Payload::from)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn payload(state: &str) -> Payload {
        Payload {
            code: "c".into(),
            state: state.into(),
        }
    }

    #[test]
    fn the_same_state_passes_once() {
        let inbox = Inbox::default();
        let now = Instant::now();
        assert!(inbox.accept(&payload("a"), now));
        assert!(!inbox.accept(&payload("a"), now));
        assert!(inbox.accept(&payload("b"), now));
        assert!(!inbox.accept(&payload("b"), now));
    }

    #[test]
    fn pending_is_taken_once() {
        let inbox = Inbox::default();
        let now = Instant::now();
        inbox.accept(&payload("a"), now);
        assert_eq!(inbox.take(now).map(|p| p.state), Some("a".to_string()));
        assert!(inbox.take(now).is_none());
    }

    #[test]
    fn pending_keeps_only_the_last_callback() {
        let inbox = Inbox::default();
        let now = Instant::now();
        inbox.accept(&payload("a"), now);
        inbox.accept(&payload("b"), now);
        assert_eq!(inbox.take(now).map(|p| p.state), Some("b".to_string()));
    }

    #[test]
    fn pending_expires_after_fifteen_minutes() {
        let inbox = Inbox::default();
        let at = Instant::now();
        inbox.accept(&payload("a"), at);
        assert!(
            inbox
                .take(at + PENDING_TTL + Duration::from_secs(1))
                .is_none()
        );
        inbox.accept(&payload("b"), at);
        assert!(inbox.take(at + PENDING_TTL).is_some());
    }

    #[test]
    fn a_dropped_pending_does_not_reopen_the_state() {
        let inbox = Inbox::default();
        let at = Instant::now();
        inbox.accept(&payload("a"), at);
        inbox.take(at);
        assert!(!inbox.accept(&payload("a"), at));
        assert!(inbox.take(at).is_none());
    }

    #[test]
    fn payload_carries_only_code_and_state() {
        let payload =
            Payload::from(sc_deep_link::parse_auth("sc://auth?code=c&state=s&x=1").unwrap());
        assert_eq!(
            serde_json::to_string(&payload).unwrap(),
            r#"{"code":"c","state":"s"}"#
        );
    }

    #[test]
    fn manual_paste_is_parsed_by_the_same_rules() {
        assert!(deep_link_parse("sc://auth?code=c&state=s".into()).is_ok());
        assert!(deep_link_parse("https://auth?code=c&state=s".into()).is_err());
    }
}
