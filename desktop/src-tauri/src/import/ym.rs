use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::Emitter;

use crate::app::diagnostics::log_native;
use crate::rt::AppHandle;

use super::ym_search;

const SESSION_EXPIRED: &str = "session_expired";

const YM_TRACKS_ATTEMPTS: u64 = 3;
const MAX_SEARCH_ERRORS_IN_ROW: usize = 15;
const SEARCH_ERROR_PAUSE: Duration = Duration::from_secs(1);

static CANCEL_FLAG: std::sync::LazyLock<Arc<AtomicBool>> =
    std::sync::LazyLock::new(|| Arc::new(AtomicBool::new(false)));

#[derive(serde::Serialize, Clone)]
pub struct YmImportProgress {
    pub total: usize,
    pub current: usize,
    pub found: usize,
    pub not_found: usize,
    pub errors: usize,
    pub current_track: String,
}

#[derive(serde::Serialize, Clone)]
pub struct YmImportMatch {
    pub urn: String,
}

#[derive(serde::Deserialize)]
struct YmLikesResponse {
    result: YmLikesResult,
}

#[derive(serde::Deserialize)]
struct YmLikesResult {
    library: YmLibrary,
}

#[derive(serde::Deserialize)]
struct YmLibrary {
    tracks: Vec<YmLikedTrack>,
}

#[derive(serde::Deserialize)]
struct YmLikedTrack {
    id: serde_json::Value,
}

#[derive(serde::Deserialize)]
struct YmTrackInfo {
    result: Vec<YmTrack>,
}

#[derive(serde::Deserialize)]
struct YmTrack {
    title: Option<String>,
    artists: Option<Vec<YmArtist>>,
}

#[derive(serde::Deserialize)]
struct YmArtist {
    name: Option<String>,
}

fn emit_progress(
    app: &AppHandle,
    total: usize,
    current: usize,
    found: usize,
    not_found: usize,
    errors: usize,
    current_track: String,
) {
    app.emit(
        "ym_import:progress",
        YmImportProgress {
            total,
            current,
            found,
            not_found,
            errors,
            current_track,
        },
    )
    .ok();
}

async fn fetch_ym_tracks(
    client: &wreq::Client,
    ym_token: &str,
    ids: &str,
) -> Result<Vec<YmTrack>, String> {
    let mut last_error = String::new();

    for attempt in 0..YM_TRACKS_ATTEMPTS {
        if attempt > 0 {
            tokio::time::sleep(Duration::from_millis(500 * attempt)).await;
        }

        let resp = match client
            .get(format!(
                "https://api.music.yandex.net/tracks?trackIds={ids}"
            ))
            .header("Authorization", format!("OAuth {ym_token}"))
            .send()
            .await
        {
            Ok(resp) => resp,
            Err(e) => {
                last_error = e.to_string();
                continue;
            }
        };

        if !resp.status().is_success() {
            last_error = format!("HTTP {}", resp.status());
            continue;
        }

        match resp.json::<YmTrackInfo>().await {
            Ok(info) => return Ok(info.result),
            Err(e) => last_error = e.to_string(),
        }
    }

    Err(last_error)
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

    let uid_resp = client
        .get("https://api.music.yandex.net/account/status")
        .header("Authorization", format!("OAuth {}", ym_token))
        .send()
        .await
        .map_err(|e| format!("YM auth failed: {}", e))?;

    if !uid_resp.status().is_success() {
        return Err(format!("YM auth failed: HTTP {}", uid_resp.status()));
    }

    let uid_json: serde_json::Value = uid_resp.json().await.map_err(|e| e.to_string())?;
    let uid = uid_json["result"]["account"]["uid"]
        .as_i64()
        .ok_or("Failed to get YM user ID")?;

    let likes_resp = client
        .get(format!(
            "https://api.music.yandex.net/users/{}/likes/tracks",
            uid
        ))
        .header("Authorization", format!("OAuth {}", ym_token))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch YM likes: {}", e))?;

    if !likes_resp.status().is_success() {
        return Err(format!(
            "Failed to fetch YM likes: HTTP {}",
            likes_resp.status()
        ));
    }

    let likes: YmLikesResponse = likes_resp.json().await.map_err(|e| e.to_string())?;
    let track_ids: Vec<String> = likes
        .result
        .library
        .tracks
        .iter()
        .map(|t| match &t.id {
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            v => v.to_string(),
        })
        .collect();

    let total = track_ids.len();
    let mut found = 0usize;
    let mut not_found = 0usize;
    let mut errors = 0usize;
    let mut search_errors_in_row = 0usize;
    let mut processed = 0usize;

    'batches: for chunk in track_ids.chunks(50) {
        if CANCEL_FLAG.load(Ordering::Relaxed) {
            break;
        }

        let tracks = match fetch_ym_tracks(&client, &ym_token, &chunk.join(",")).await {
            Ok(tracks) => tracks,
            Err(reason) => {
                log_native(
                    &app,
                    "WARN",
                    format!("[YM Import] tracks request failed: {reason}"),
                );
                let remaining = total.saturating_sub(processed);
                for _ in 0..chunk.len().min(remaining) {
                    processed += 1;
                    errors += 1;
                    emit_progress(
                        &app,
                        total,
                        processed,
                        found,
                        not_found,
                        errors,
                        String::new(),
                    );
                }
                continue;
            }
        };

        for track in tracks.iter() {
            if CANCEL_FLAG.load(Ordering::Relaxed) {
                break 'batches;
            }

            processed += 1;
            let title = track.title.as_deref().unwrap_or("");
            let artist = track
                .artists
                .as_ref()
                .and_then(|a: &Vec<YmArtist>| a.first())
                .and_then(|a| a.name.as_deref())
                .unwrap_or("");

            if title.is_empty() && artist.is_empty() {
                not_found += 1;
                emit_progress(
                    &app,
                    total,
                    processed,
                    found,
                    not_found,
                    errors,
                    String::new(),
                );
                continue;
            }

            let current_track = format!("{} - {}", artist, title);

            match ym_search::find_track(&client, &backend_url, &session_id, artist, title).await {
                Ok(Some(urn)) => {
                    search_errors_in_row = 0;
                    found += 1;
                    app.emit("ym_import:match", YmImportMatch { urn }).ok();
                }
                Ok(None) => {
                    search_errors_in_row = 0;
                    not_found += 1;
                }
                Err(error) if error.is_unauthorized() => {
                    errors += 1;
                    log_native(
                        &app,
                        "WARN",
                        "[YM Import] search rejected the session (HTTP 401)",
                    );
                    emit_progress(
                        &app,
                        total,
                        processed,
                        found,
                        not_found,
                        errors,
                        current_track,
                    );
                    return Err(SESSION_EXPIRED.to_string());
                }
                Err(error) => {
                    let reason = error.reason;
                    errors += 1;
                    search_errors_in_row += 1;
                    if search_errors_in_row == 1 {
                        log_native(&app, "WARN", format!("[YM Import] search failed: {reason}"));
                    }
                    if search_errors_in_row >= MAX_SEARCH_ERRORS_IN_ROW {
                        emit_progress(
                            &app,
                            total,
                            processed,
                            found,
                            not_found,
                            errors,
                            current_track,
                        );
                        return Err(format!("SoundCloud search unavailable: {reason}"));
                    }
                    tokio::time::sleep(SEARCH_ERROR_PAUSE).await;
                }
            }

            emit_progress(
                &app,
                total,
                processed,
                found,
                not_found,
                errors,
                current_track.clone(),
            );

            tokio::time::sleep(Duration::from_millis(150)).await;
        }

        if tracks.len() < chunk.len() {
            let missed = chunk.len() - tracks.len();
            let remaining = total.saturating_sub(processed);
            for _ in 0..missed.min(remaining) {
                processed += 1;
                not_found += 1;
                emit_progress(
                    &app,
                    total,
                    processed,
                    found,
                    not_found,
                    errors,
                    String::new(),
                );
            }
        }
    }

    emit_progress(
        &app,
        total,
        processed,
        found,
        not_found,
        errors,
        String::new(),
    );

    Ok(())
}

#[tauri::command]
pub fn ym_import_stop() {
    CANCEL_FLAG.store(true, Ordering::Relaxed);
}
