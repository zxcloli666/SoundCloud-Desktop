use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::app::diagnostics;

const SIGNED_OUT: &str = "signed-out";

pub struct Session {
    last: Mutex<Option<String>>,
    logged_out: AtomicBool,
    marker: PathBuf,
}

impl Session {
    pub fn stored_in(dir: &Path) -> Self {
        let marker = dir.join(SIGNED_OUT);
        Self {
            last: Mutex::new(None),
            logged_out: AtomicBool::new(marker.exists()),
            marker,
        }
    }

    pub fn changed(&self, token: Option<&str>) -> bool {
        let Ok(mut last) = self.last.lock() else {
            return true;
        };
        if last.as_deref() == token {
            return false;
        }
        *last = token.map(str::to_string);
        true
    }

    pub fn signed_in(&self) -> bool {
        self.last.lock().is_ok_and(|last| last.is_some())
    }

    pub fn log_out(&self) {
        self.logged_out.store(true, Ordering::Release);
        if let Err(error) = std::fs::write(&self.marker, []) {
            diagnostics::warn(format!("[chat] sign-out marker: {error}"));
        }
    }

    pub fn log_in(&self) {
        self.logged_out.store(false, Ordering::Release);
        match std::fs::remove_file(&self.marker) {
            Err(error) if error.kind() != ErrorKind::NotFound => {
                diagnostics::warn(format!("[chat] sign-out marker: {error}"));
            }
            _ => {}
        }
    }

    pub fn logged_out(&self) -> bool {
        self.logged_out.load(Ordering::Acquire)
    }
}
