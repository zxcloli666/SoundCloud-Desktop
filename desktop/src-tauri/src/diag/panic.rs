use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

use super::errors::{ErrorEntry, ErrorInput, entry_of};

const FILE: &str = "last_panic.json";

static DIR: OnceLock<PathBuf> = OnceLock::new();

#[derive(Serialize, Deserialize)]
struct Saved {
    message: String,
    stack: String,
}

pub fn set_dir(dir: PathBuf) {
    let _ = DIR.set(dir);
}

pub fn remember(message: &str, stack: &str) {
    let Some(dir) = DIR.get() else { return };
    let saved = Saved {
        message: message.to_string(),
        stack: stack.to_string(),
    };
    if let Ok(bytes) = serde_json::to_vec(&saved) {
        let _ = std::fs::write(dir.join(FILE), bytes);
    }
}

pub fn take(dir: &Path) -> Option<ErrorEntry> {
    let path = dir.join(FILE);
    let bytes = std::fs::read(&path).ok()?;
    let _ = std::fs::remove_file(&path);
    let saved: Saved = serde_json::from_slice(&bytes).ok()?;
    Some(entry_of(ErrorInput {
        kind: "panic".to_string(),
        message: saved.message,
        stack: Some(saved.stack),
        component_stack: None,
        trace: None,
        context: Default::default(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_saved_panic_is_read_once() {
        let dir = std::env::temp_dir().join(format!("scd-panic-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let saved = Saved {
            message: "thread 'x' panicked at src/a.rs:1:2: boom".into(),
            stack: "frame".into(),
        };
        std::fs::write(dir.join(FILE), serde_json::to_vec(&saved).unwrap()).unwrap();
        let entry = take(&dir).unwrap();
        assert_eq!(entry.kind, "panic");
        assert_eq!(entry.fingerprint.len(), 16);
        assert!(take(&dir).is_none());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
