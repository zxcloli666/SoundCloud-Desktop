use std::sync::Mutex;

use sc_deep_link::AuthCallback;
use serde::Serialize;
use tauri::{Emitter, Manager, Url};
use tauri_plugin_deep_link::DeepLinkExt;

use crate::app::{diagnostics, visibility};
use crate::rt::AppHandle;

const EVENT: &str = "mobile-link:callback";
const WINDOW: &str = "main";

#[derive(Default)]
pub struct Seen(Mutex<Option<String>>);

impl Seen {
    fn first_time(&self, state: &str) -> bool {
        let mut last = self.0.lock().unwrap_or_else(|e| e.into_inner());
        if last.as_deref() == Some(state) {
            return false;
        }
        *last = Some(state.to_owned());
        true
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
    app.manage(Seen::default());
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
    let fresh = app.state::<Seen>().first_time(&payload.state);
    if !fresh {
        return;
    }
    visibility::show_main(app);
    if let Err(e) = app.emit_to(WINDOW, EVENT, payload) {
        diagnostics::warn(format!("[DeepLink] emit failed: {e}"));
    }
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

    #[test]
    fn the_same_state_passes_once() {
        let seen = Seen::default();
        assert!(seen.first_time("a"));
        assert!(!seen.first_time("a"));
        assert!(seen.first_time("b"));
        assert!(!seen.first_time("b"));
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
