use std::time::Duration;

use serde::Serialize;

use super::app_info;
use super::bundle::{self, Inputs, Trigger};
use super::errors::{self, ErrorEntry, ErrorInput};
use super::queue::{self, Delivery};
use super::{attempt, offline, report, session, trace};
use crate::app::log_sink;
use crate::network::netcheck;

const NETCHECK_AGE: Duration = Duration::from_secs(30 * 60);

#[derive(Serialize)]
pub struct EventBatch {
    app: app_info::AppInfo,
    events: Vec<ErrorEntry>,
}

#[tauri::command]
pub fn diag_error(error: ErrorInput) -> usize {
    report::error(error)
}

#[tauri::command]
pub fn diag_set_reporting(enabled: bool) {
    queue::set_enabled(enabled);
}

#[tauri::command]
pub fn diag_session(logged_in: bool, premium: bool, quality: String, locale: String) {
    session::set(logged_in, premium, quality, locale);
}

#[tauri::command]
pub fn diag_bundle(trigger: Trigger) -> String {
    trace::open_debug();
    let attempts = attempt::oldest_first();
    let inputs = Inputs {
        app: app_info::current(),
        session: session::snapshot(session::route_of(&attempts)),
        trigger,
        netcheck: netcheck::text_within(NETCHECK_AGE),
        log_path: log_sink::path().map(std::path::Path::to_path_buf),
    };
    let bytes = bundle::build(inputs, attempts, errors::all());
    String::from_utf8_lossy(&bytes).into_owned()
}

#[tauri::command]
pub fn diag_save_file(bundle: String) -> Result<String, String> {
    let dir = dirs::download_dir().ok_or("no downloads folder")?;
    let path = offline::write(&dir, bundle.as_bytes())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn diag_queue_batch() -> Option<EventBatch> {
    let events = queue::batch();
    (!events.is_empty()).then(|| EventBatch {
        app: app_info::current(),
        events,
    })
}

#[tauri::command]
pub fn diag_queue_settle(delivery: Delivery) {
    queue::settle_batch(delivery);
}
