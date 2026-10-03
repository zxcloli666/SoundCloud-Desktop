mod matcher;
mod yandex;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::Emitter;

use crate::rt::AppHandle;
use matcher::{Matcher, Outcome};
use yandex::Yandex;

static CANCEL_FLAG: AtomicBool = AtomicBool::new(false);

const YM_BATCH: usize = 50;
const ROW_PAUSE_MS: u64 = 150;

#[derive(serde::Serialize, Clone, Default)]
pub struct YmImportProgress {
    pub total: usize,
    pub current: usize,
    pub found: usize,
    pub not_found: usize,
    pub uncertain: usize,
    pub failed: usize,
    pub current_track: String,
}

#[derive(serde::Serialize, Clone)]
pub struct YmImportMatch {
    pub urn: String,
    pub confidence: Option<f64>,
}

impl YmImportProgress {
    fn emit(&self, app: &AppHandle) {
        app.emit("ym_import:progress", self.clone()).ok();
    }

    fn skip(&mut self, app: &AppHandle, rows: usize) {
        for _ in 0..rows.min(self.total.saturating_sub(self.current)) {
            self.current += 1;
            self.failed += 1;
            self.current_track.clear();
            self.emit(app);
        }
    }
}

#[tauri::command]
pub async fn ym_import_start(
    ym_token: String,
    backend_url: String,
    session_id: String,
    app: AppHandle,
) -> Result<(), String> {
    CANCEL_FLAG.store(false, Ordering::Relaxed);

    let client = wreq::Client::new();
    let yandex = Yandex::new(client.clone(), &ym_token);
    let track_ids = yandex.liked_track_ids().await?;
    let mut matcher = Matcher::new(client, backend_url, session_id, &CANCEL_FLAG);
    let mut progress = YmImportProgress {
        total: track_ids.len(),
        ..Default::default()
    };

    'batches: for chunk in track_ids.chunks(YM_BATCH) {
        if CANCEL_FLAG.load(Ordering::Relaxed) {
            break;
        }
        let Some(tracks) = yandex.tracks(chunk).await else {
            progress.skip(&app, chunk.len());
            continue;
        };
        let missing = chunk.len().saturating_sub(tracks.len());

        for track in &tracks {
            if CANCEL_FLAG.load(Ordering::Relaxed) {
                break 'batches;
            }
            if track.is_blank() {
                progress.current += 1;
                progress.not_found += 1;
                progress.emit(&app);
                continue;
            }
            progress.current_track = track.label();
            match matcher.find(track).await {
                Outcome::Cancelled => break 'batches,
                Outcome::Found { urn, confidence } => {
                    progress.found += 1;
                    app.emit("ym_import:match", YmImportMatch { urn, confidence })
                        .ok();
                }
                Outcome::Uncertain => progress.uncertain += 1,
                Outcome::NotFound => progress.not_found += 1,
                Outcome::Failed => progress.failed += 1,
            }
            progress.current += 1;
            progress.emit(&app);
            tokio::time::sleep(std::time::Duration::from_millis(ROW_PAUSE_MS)).await;
        }

        progress.skip(&app, missing);
    }

    progress.current_track.clear();
    progress.emit(&app);
    Ok(())
}

#[tauri::command]
pub fn ym_import_stop() {
    CANCEL_FLAG.store(true, Ordering::Relaxed);
}
