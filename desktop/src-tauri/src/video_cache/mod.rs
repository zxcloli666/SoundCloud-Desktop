mod fetch;
mod lru;
mod progress;
mod source;

pub mod commands;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use futures_util::future::{FutureExt, Shared};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

use self::progress::Progress;
use crate::app::diagnostics;
use crate::network::system_proxy::follow;
use crate::shared::file_lru::mark_used;

const PROGRESS_EVENT: &str = "video:progress";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);

type Flight = Shared<Pin<Box<dyn Future<Output = Result<String, String>> + Send>>>;

#[derive(Clone, Serialize)]
struct Loading<'a> {
    url: &'a str,
    #[serde(flatten)]
    progress: Progress,
}

pub struct VideoCache {
    app: AppHandle,
    dir: PathBuf,
    client: wreq::Client,
    flights: Mutex<HashMap<String, Flight>>,
}

impl VideoCache {
    pub fn init(app: AppHandle, dir: PathBuf) -> Arc<Self> {
        std::fs::create_dir_all(&dir).ok();
        lru::sweep_parts(&dir);
        let client = follow(sc_fingerprint::builder(None))
            .redirect(wreq::redirect::Policy::none())
            .tcp_nodelay(true)
            .connect_timeout(CONNECT_TIMEOUT)
            .build()
            .expect("failed to build video client");
        Arc::new(Self {
            app,
            dir,
            client,
            flights: Mutex::new(HashMap::new()),
        })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub async fn fetch(self: Arc<Self>, url: String) -> Result<String, String> {
        let checked = source::checked(&url)?;
        let name = file_name(checked.as_str());
        let path = self.dir.join(&name);
        if path.is_file() {
            mark_used(&path);
            return Ok(name);
        }
        let flight = self.flight(url, checked.to_string(), name, path);
        flight.await
    }

    fn flight(self: &Arc<Self>, asked: String, url: String, name: String, path: PathBuf) -> Flight {
        let mut flights = match self.flights.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        };
        if let Some(flight) = flights.get(&name) {
            return flight.clone();
        }
        let cache = self.clone();
        let key = name.clone();
        let flight = async move {
            let report = |progress| cache.report(&asked, progress);
            let result = fetch::download(&cache.client, &url, &path, &report).await;
            cache.land(&key, &result);
            result.map(|()| key)
        }
        .boxed()
        .shared();
        flights.insert(name, flight.clone());
        flight
    }

    fn report(&self, url: &str, progress: Progress) {
        self.app
            .emit(PROGRESS_EVENT, Loading { url, progress })
            .ok();
    }

    fn land(&self, name: &str, result: &Result<(), String>) {
        if let Ok(mut flights) = self.flights.lock() {
            flights.remove(name);
        }
        if let Err(err) = result {
            diagnostics::warn(format!("[Video] {name}: {err}"));
        }
    }
}

fn file_name(url: &str) -> String {
    format!("{}.mp4", hex::encode(Sha256::digest(url.as_bytes())))
}

#[cfg(test)]
mod tests {
    use super::file_name;
    use crate::network::video_server::is_file_name;

    #[test]
    fn names_are_served_hex_hashes_of_the_url() {
        let name = file_name("https://storage.scnative.dev/video/1-1.mp4");
        assert!(is_file_name(&name));
        assert_ne!(name, file_name("https://storage.scnative.dev/video/1-2.mp4"));
    }
}
