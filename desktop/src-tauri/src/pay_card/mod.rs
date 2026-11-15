pub mod commands;
mod http;
pub mod page;

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use pay_card::{Keys, SerialStore, Session};
use tokio::sync::Notify;

use crate::shared::constants::PAY_BUNDLE_KEYS;

const KEPT_SERIAL_FILES: [(&str, &str); 2] = [
    ("bind", "boosty_bundle_serial.txt"),
    ("token", "boosty_bundle_serial_token.txt"),
];

pub struct PayCard {
    keys: Keys,
    data_dir: PathBuf,
    fetch: Option<Arc<http::DirectFetch>>,
    session: Mutex<Option<Session>>,
    abort: Notify,
    busy: AtomicBool,
}

impl PayCard {
    pub fn new(data_dir: &Path, runtime: tokio::runtime::Handle) -> Self {
        Self {
            keys: Keys::parse(PAY_BUNDLE_KEYS.unwrap_or_default()),
            data_dir: data_dir.to_path_buf(),
            fetch: http::DirectFetch::new(runtime).map(Arc::new),
            session: Mutex::new(None),
            abort: Notify::new(),
            busy: AtomicBool::new(false),
        }
    }

    fn serials(&self, entry: &str) -> SerialStore {
        SerialStore::at(self.data_dir.join(serial_file(entry)))
    }

    fn supported(&self) -> bool {
        !self.keys.is_empty() && self.fetch.is_some()
    }
}

fn serial_file(entry: &str) -> String {
    KEPT_SERIAL_FILES
        .iter()
        .find(|(kept, _)| *kept == entry)
        .map_or_else(
            || format!("pay_bundle_serial_{entry}.txt"),
            |(_, file)| file.to_string(),
        )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn current_entries_keep_their_serial_files() {
        assert_eq!(serial_file("bind"), "boosty_bundle_serial.txt");
        assert_eq!(serial_file("token"), "boosty_bundle_serial_token.txt");
        assert_eq!(serial_file("confirm"), "pay_bundle_serial_confirm.txt");
    }
}
