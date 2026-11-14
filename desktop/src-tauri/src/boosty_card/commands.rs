use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use boosty_card::{
    Bundle, Card, Confirmed, Kind, Pace, Params, Phase, Session, Verdict, open, submit, tokenize,
};
use chrono::{Datelike, Local};
use tauri::{Emitter, State};

use super::{BoostyCard, three_ds};
use crate::app::diagnostics;
use crate::rt::AppHandle;

const PHASE_EVENT: &str = "boosty-card:phase";

struct Busy<'a>(&'a AtomicBool);

impl Drop for Busy<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
pub fn boosty_card_supported(card: State<'_, Arc<BoostyCard>>) -> bool {
    card.supported()
}

#[tauri::command]
pub fn boosty_card_open(
    card: State<'_, Arc<BoostyCard>>,
    bundle: Bundle,
    params: Params,
) -> Result<(), String> {
    let fetch = card.fetch.clone().ok_or("unsupported")?;
    if card.keys.is_empty() {
        return Err("unsupported".into());
    }
    let serial = bundle.serial;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |since| since.as_secs() as i64);
    let serials = card.serials(params.kind());
    match open(bundle, params, &card.keys, serials, now, fetch) {
        Ok(session) => {
            *card.session.lock().map_err(|_| "state")? = Some(session);
            diagnostics::log("INFO", format!("[BoostyCard] bundle {serial} accepted"));
            Ok(())
        }
        Err(rejected) => {
            diagnostics::warn(format!(
                "[BoostyCard] bundle {serial} refused: {}",
                rejected.code()
            ));
            Err(rejected.code().into())
        }
    }
}

#[tauri::command]
pub async fn boosty_card_submit(
    app: AppHandle,
    state: State<'_, Arc<BoostyCard>>,
    card: Card,
) -> Result<Verdict, String> {
    if state.busy.swap(true, Ordering::SeqCst) {
        return Err("busy".into());
    }
    let _busy = Busy(&state.busy);
    let kind = state
        .session
        .lock()
        .map_err(|_| "state")?
        .as_ref()
        .map(Session::kind)
        .ok_or("no_session")?;
    let mut card = card;
    let today = Local::now();
    card.tidy(today.year(), today.month())
        .map_err(|invalid| invalid.code())?;
    let session = state
        .session
        .lock()
        .map_err(|_| "state")?
        .take()
        .ok_or("no_session")?;

    let aborted = state.abort.notified();
    let windows = app.clone();
    let events = app.clone();
    let phase = move |phase: Phase| {
        let _ = events.emit_to("main", PHASE_EVENT, phase);
    };
    let pace = Pace::default();
    let verdict = match kind {
        Kind::Bind => {
            let run = submit(
                &session,
                card,
                &pace,
                move |url: String| three_ds::confirm(windows, url),
                phase,
            );
            tokio::select! {
                verdict = run => verdict,
                _ = aborted => Verdict::Failed { reason: "aborted".into() },
            }
        }
        Kind::Token => tokio::select! {
            verdict = tokenize(&session, card, phase) => verdict,
            _ = aborted => Verdict::Failed { reason: "aborted".into() },
        },
    };
    diagnostics::log(
        "INFO",
        format!("[BoostyCard] submit ended: {}", summary(&verdict)),
    );
    if matches!(verdict, Verdict::Invalid { .. } | Verdict::Tokenized { .. }) {
        *state.session.lock().map_err(|_| "state")? = Some(session);
    }
    Ok(verdict)
}

#[tauri::command]
pub async fn boosty_card_page(
    app: AppHandle,
    state: State<'_, Arc<BoostyCard>>,
    url: String,
) -> Result<&'static str, String> {
    let near = state
        .session
        .lock()
        .map_err(|_| "state")?
        .as_ref()
        .map(|session| session.takes_page(&url));
    match near {
        None => return Err("no_session".into()),
        Some(false) => {
            diagnostics::warn(format!("[BoostyCard] bank page refused: {}", host_of(&url)));
            return Err("bad_page".into());
        }
        Some(true) => {}
    }
    let aborted = state.abort.notified();
    let ended = tokio::select! {
        how = three_ds::confirm(app, url) => how,
        _ = aborted => return Ok("aborted"),
    };
    Ok(match ended {
        Confirmed::Closed => "closed",
        Confirmed::Success | Confirmed::Failure => "done",
    })
}

#[tauri::command]
pub fn boosty_card_abort(card: State<'_, Arc<BoostyCard>>) {
    card.abort.notify_waiters();
}

#[tauri::command]
pub fn boosty_card_close(card: State<'_, Arc<BoostyCard>>) {
    card.abort.notify_waiters();
    if let Ok(mut session) = card.session.lock() {
        session.take();
    }
}

fn summary(verdict: &Verdict) -> String {
    match verdict {
        Verdict::Succeeded => "succeeded".into(),
        Verdict::Failed { reason } => format!("failed ({reason})"),
        Verdict::Invalid { field } => format!("invalid ({field})"),
        Verdict::Tokenized { .. } => "tokenized".into(),
        Verdict::Timeout => "timeout".into(),
    }
}

fn host_of(url: &str) -> String {
    tauri::Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| "?".into())
}
