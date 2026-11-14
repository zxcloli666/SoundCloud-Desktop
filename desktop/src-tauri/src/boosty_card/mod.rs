pub mod commands;
mod http;
pub mod three_ds;

use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use boosty_card::{Keys, Kind, SerialStore, Session};
use tokio::sync::Notify;

use crate::shared::constants::BOOSTY_BUNDLE_KEYS;

const BIND_SERIAL_FILE: &str = "boosty_bundle_serial.txt";
const TOKEN_SERIAL_FILE: &str = "boosty_bundle_serial_token.txt";

pub struct BoostyCard {
    keys: Keys,
    bind_serials: SerialStore,
    token_serials: SerialStore,
    fetch: Option<Arc<http::DirectFetch>>,
    session: Mutex<Option<Session>>,
    abort: Notify,
    busy: AtomicBool,
}

impl BoostyCard {
    pub fn new(data_dir: &Path, runtime: tokio::runtime::Handle) -> Self {
        Self {
            keys: Keys::parse(BOOSTY_BUNDLE_KEYS.unwrap_or_default()),
            bind_serials: SerialStore::at(data_dir.join(BIND_SERIAL_FILE)),
            token_serials: SerialStore::at(data_dir.join(TOKEN_SERIAL_FILE)),
            fetch: http::DirectFetch::new(runtime).map(Arc::new),
            session: Mutex::new(None),
            abort: Notify::new(),
            busy: AtomicBool::new(false),
        }
    }

    fn serials(&self, kind: Kind) -> &SerialStore {
        match kind {
            Kind::Bind => &self.bind_serials,
            Kind::Token => &self.token_serials,
        }
    }

    fn supported(&self) -> bool {
        !self.keys.is_empty() && self.fetch.is_some()
    }
}
