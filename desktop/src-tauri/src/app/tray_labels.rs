use std::sync::{LazyLock, RwLock};

use serde::Deserialize;

use crate::rt::AppHandle;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayLabels {
    pub show: String,
    pub mini: String,
    pub play_pause: String,
    pub prev: String,
    pub next: String,
    pub quit: String,
}

impl Default for TrayLabels {
    fn default() -> Self {
        Self {
            show: "Show".into(),
            mini: "Mini player".into(),
            play_pause: "Play / Pause".into(),
            prev: "Previous".into(),
            next: "Next".into(),
            quit: "Quit".into(),
        }
    }
}

static LABELS: LazyLock<RwLock<TrayLabels>> = LazyLock::new(Default::default);

pub fn current() -> TrayLabels {
    LABELS.read().map(|labels| labels.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn tray_set_labels(app: AppHandle, labels: TrayLabels) {
    if let Ok(mut stored) = LABELS.write() {
        *stored = labels;
    }
    super::tray::refresh_labels(&app);
    super::taskbar::refresh_labels(&app);
}
