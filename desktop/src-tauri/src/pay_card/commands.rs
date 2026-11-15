use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::{Datelike, Local};
use pay_card::{Bundle, Card, Env, Outcome, Session, Visit, open, valid_entry, visit};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{Emitter, State};

use super::{PayCard, page};
use crate::app::diagnostics;
use crate::rt::AppHandle;

const PHASE_EVENT: &str = "card:phase";
const PAGE_BUDGET: Duration = Duration::from_secs(8 * 60);

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum Phase {
    Sending,
    Confirm,
    Checking,
}

#[derive(Deserialize)]
pub struct EnvArg {
    language: String,
    tz_offset: i32,
}

struct Busy<'a>(&'a AtomicBool);

impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

fn phase(app: &AppHandle, phase: Phase) {
    let _ = app.emit_to("main", PHASE_EVENT, phase);
}

fn current(state: &PayCard) -> Result<Session, String> {
    state
        .session
        .lock()
        .map_err(|_| "state")?
        .clone()
        .ok_or_else(|| "no_session".into())
}

#[tauri::command]
pub fn card_supported(card: State<'_, Arc<PayCard>>) -> bool {
    card.supported()
}

#[tauri::command]
pub fn card_open(
    card: State<'_, Arc<PayCard>>,
    bundle: Bundle,
    params: Value,
    env: EnvArg,
) -> Result<&'static str, String> {
    let fetch = card.fetch.clone().ok_or("unsupported")?;
    if card.keys.is_empty() {
        return Err("unsupported".into());
    }
    if !valid_entry(&bundle.entry) {
        return Err("entry".into());
    }
    let (serial, entry) = (bundle.serial, bundle.entry.clone());
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs() as i64);
    let env = Env {
        language: env.language,
        tz_offset: env.tz_offset,
    };
    let serials = card.serials(&entry);
    match open(bundle, params, env, &card.keys, &serials, now, fetch) {
        Ok(session) => {
            let flow = session.flow().as_str();
            *card.session.lock().map_err(|_| "state")? = Some(session);
            diagnostics::log(
                "INFO",
                format!("[PayCard] bundle {entry} {serial} accepted"),
            );
            Ok(flow)
        }
        Err(rejected) => {
            diagnostics::warn(format!(
                "[PayCard] bundle {entry} {serial} refused: {}",
                rejected.code()
            ));
            Err(rejected.code().into())
        }
    }
}

#[tauri::command]
pub async fn card_submit(
    app: AppHandle,
    state: State<'_, Arc<PayCard>>,
    card: Card,
) -> Result<Outcome, String> {
    if state.busy.swap(true, Ordering::SeqCst) {
        return Err("busy".into());
    }
    let _busy = Busy(&state.busy);
    let session = current(&state)?;
    let mut card = card;
    let today = Local::now();
    if let Err(invalid) = card.tidy(today.year(), today.month()) {
        return Ok(Outcome::Invalid {
            field: invalid.field().into(),
        });
    }
    phase(&app, Phase::Sending);
    let aborted = state.abort.notified();
    let outcome = tokio::select! {
        ran = session.submit(card) => ran.unwrap_or_else(|error| Outcome::failed(error.code())),
        _ = aborted => Outcome::failed("aborted"),
    };
    diagnostics::log(
        "INFO",
        format!("[PayCard] submit ended: {}", summary(&outcome)),
    );
    Ok(outcome)
}

#[tauri::command]
pub async fn card_page(
    app: AppHandle,
    state: State<'_, Arc<PayCard>>,
    url: String,
) -> Result<Value, String> {
    let session = current(&state)?;
    if !session.takes_page(&url) {
        diagnostics::warn(format!("[PayCard] page refused: {}", host_of(&url)));
        return Err("bad_page".into());
    }
    phase(&app, Phase::Confirm);
    let aborted = state.abort.notified();
    let windows = app.clone();
    let shown = session.clone();
    let run = visit(&session, &url, PAGE_BUDGET, async move |url: String| {
        page::show(windows, shown, url).await
    });
    let visited = tokio::select! {
        visited = run => visited,
        _ = aborted => return Ok(json!({ "end": "aborted" })),
    };
    if matches!(visited, Visit::Result { .. }) {
        phase(&app, Phase::Checking);
    }
    serde_json::to_value(visited).map_err(|_| "state".into())
}

#[tauri::command]
pub fn card_abort(card: State<'_, Arc<PayCard>>) {
    card.abort.notify_waiters();
}

#[tauri::command]
pub fn card_close(card: State<'_, Arc<PayCard>>) {
    card.abort.notify_waiters();
    if let Ok(mut session) = card.session.lock() {
        session.take();
    }
}

fn summary(outcome: &Outcome) -> String {
    match outcome {
        Outcome::Failed { reason } => format!("failed ({reason})"),
        Outcome::Invalid { field } => format!("invalid ({field})"),
        Outcome::Page { .. } => "page".into(),
        Outcome::Token { .. } => "token".into(),
        Outcome::Succeeded { .. } => "succeeded".into(),
        Outcome::Pending { .. } => "pending".into(),
    }
}

fn host_of(url: &str) -> String {
    tauri::Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| "?".into())
}
