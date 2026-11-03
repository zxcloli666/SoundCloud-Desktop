use std::collections::HashSet;
use std::sync::atomic::AtomicBool;

use crate::app::diagnostics::log_native;
use crate::rt::AppHandle;
use crate::shared::urn::canonical_track_urn;

use super::failure::Failure;
use super::matcher::match_quiet;
use super::request::Request;
use super::run::{build_client, read};
use super::sync_plan::{Ledger, appendable, fresh, key, reconcile, syncable};

#[derive(serde::Deserialize)]
pub struct SyncInput {
    pub request: Request,
    pub baseline: bool,
    pub seen: Vec<String>,
    pub added: Vec<String>,
    pub latest: Vec<String>,
    pub removed: Vec<String>,
    pub current: Vec<String>,
}

#[derive(serde::Serialize, Debug)]
pub struct SyncOutput {
    pub title: String,
    pub seen: Vec<String>,
    pub added: Vec<String>,
    pub latest: Vec<String>,
    pub removed: Vec<String>,
    pub to_add: Vec<String>,
    pub fresh: usize,
    pub unmatched: usize,
}

fn urn_set(urns: &[String]) -> HashSet<String> {
    urns.iter()
        .filter_map(|urn| canonical_track_urn(urn))
        .collect()
}

pub async fn pull(
    input: SyncInput,
    backend_url: &str,
    session_id: &str,
) -> Result<SyncOutput, Failure> {
    let client = build_client()?;
    let cancel = AtomicBool::new(false);
    let list = read(&client, input.request, &cancel, &|_, _| {}).await?;

    let mut seen: Vec<String> = input.seen;
    let known: HashSet<String> = seen.iter().cloned().collect();
    let current = urn_set(&input.current);
    let ledger = reconcile(
        Ledger {
            added: input.added,
            latest: input.latest,
            removed: input.removed,
        },
        &current,
    );

    let new_tracks = if input.baseline {
        Vec::new()
    } else {
        fresh(&list.tracks, &known)
    };
    let matched = if new_tracks.is_empty() {
        Vec::new()
    } else {
        match_quiet(&client, backend_url, session_id, &new_tracks, &cancel).await?
    };
    let unmatched = matched.iter().filter(|urn| urn.is_none()).count();
    let to_add = appendable(matched, &ledger, &current);

    let mut seen_set = known;
    for track in &list.tracks {
        let key = key(track);
        if seen_set.insert(key.clone()) {
            seen.push(key);
        }
    }
    let mut added = ledger.added;
    added.extend(to_add.iter().cloned());
    Ok(SyncOutput {
        title: list.title,
        seen,
        added,
        latest: to_add.clone(),
        removed: ledger.removed,
        fresh: new_tracks.len(),
        unmatched,
        to_add,
    })
}

#[tauri::command]
pub async fn import_sync_pull(
    input: SyncInput,
    backend_url: String,
    session_id: String,
    app: AppHandle,
) -> Result<SyncOutput, String> {
    pull(input, &backend_url, &session_id)
        .await
        .map_err(|failure| {
            log_native(
                &app,
                "WARN",
                format!("[Import] sync failed: {}", failure.detail),
            );
            failure.code.to_string()
        })
}

#[tauri::command]
pub fn import_syncable(request: Request) -> bool {
    syncable(&request)
}
