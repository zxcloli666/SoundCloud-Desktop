use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};

#[derive(Default)]
pub struct Session {
    last: Mutex<Option<String>>,
    logged_out: AtomicBool,
}

impl Session {
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
    }

    pub fn log_in(&self) {
        self.logged_out.store(false, Ordering::Release);
    }

    pub fn logged_out(&self) -> bool {
        self.logged_out.load(Ordering::Acquire)
    }
}
