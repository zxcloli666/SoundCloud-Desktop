pub mod commands;
mod gate;

use std::error::Error;
use std::fmt;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, OnceLock};

use serde::{Deserialize, Serialize};
use tokio::sync::watch;

pub use self::gate::gate;

const FILE: &str = "offline_mode.json";

static STATE: LazyLock<watch::Sender<bool>> = LazyLock::new(|| watch::Sender::new(false));
static STORED_AT: OnceLock<PathBuf> = OnceLock::new();
static REFUSED: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub struct Offline;

impl fmt::Display for Offline {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("offline mode is on")
    }
}

impl Error for Offline {}

#[derive(Serialize, Deserialize)]
struct Stored {
    on: bool,
}

pub fn load(dir: &Path) -> bool {
    let path = dir.join(FILE);
    let on = std::fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Stored>(&bytes).ok())
        .is_some_and(|stored| stored.on);
    let _ = STORED_AT.set(path);
    STATE.send_replace(on);
    on
}

pub fn on() -> bool {
    *STATE.borrow()
}

pub fn set(on: bool) -> bool {
    let changed = STATE.send_if_modified(|current| {
        let changed = *current != on;
        *current = on;
        changed
    });
    if changed {
        save(on);
    }
    changed
}

pub fn watch() -> watch::Receiver<bool> {
    STATE.subscribe()
}

pub async fn online() {
    let _ = watch().wait_for(|on| !*on).await;
}

pub async fn entered() {
    let _ = watch().wait_for(|on| *on).await;
}

pub async fn resumed() {
    let mut changes = watch();
    let _ = changes.wait_for(|on| *on).await;
    let _ = changes.wait_for(|on| !*on).await;
}

pub fn note_refused() {
    REFUSED.fetch_add(1, Ordering::Relaxed);
}

pub fn take_refused() -> u64 {
    REFUSED.swap(0, Ordering::Relaxed)
}

fn save(on: bool) {
    let Some(path) = STORED_AT.get() else {
        return;
    };
    let bytes = serde_json::to_vec(&Stored { on }).unwrap_or_default();
    let tmp = path.with_extension("tmp");
    if std::fs::write(&tmp, bytes).is_ok() && std::fs::rename(&tmp, path).is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
}
