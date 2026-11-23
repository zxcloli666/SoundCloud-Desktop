mod desk;
mod fetch;
mod loader;
mod lru;
mod ranges;
mod reel;
mod source;

pub mod commands;
pub mod server;

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use sha2::{Digest, Sha256};
use tokio::sync::watch;

use self::desk::Desk;
use self::reel::Reel;
use crate::network::system_proxy::follow;
use crate::shared::file_lru::mark_used;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(8);

pub struct VideoCache {
    dir: PathBuf,
    client: wreq::Client,
    desk: Mutex<Desk>,
    poke: watch::Sender<()>,
}

impl VideoCache {
    pub fn init(dir: PathBuf) -> Arc<Self> {
        std::fs::create_dir_all(&dir).ok();
        lru::sweep_parts(&dir);
        let client = follow(sc_fingerprint::builder(None))
            .redirect(wreq::redirect::Policy::none())
            .tcp_nodelay(true)
            .connect_timeout(CONNECT_TIMEOUT)
            .build()
            .expect("failed to build video client");
        Arc::new(Self {
            dir,
            client,
            desk: Mutex::default(),
            poke: watch::Sender::new(()),
        })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    pub async fn open(&self, url: &str) -> Result<String, String> {
        let (name, reel) = self.reel_of(url)?;
        if let Some(reel) = reel {
            self.bring_front(&reel);
            reel.opened().await?;
        }
        Ok(name)
    }

    pub fn load_ahead(&self, url: &str) -> Result<(), String> {
        if let (_, Some(reel)) = self.reel_of(url)? {
            self.desk().put_ahead(&reel);
            self.poke.send_replace(());
        }
        Ok(())
    }

    pub fn reel(&self, name: &str) -> Option<Arc<Reel>> {
        self.desk().named(name)
    }

    pub async fn ready(&self, reel: &Arc<Reel>, at: u64) -> Result<u64, String> {
        if let Some(end) = reel.run_end(at) {
            return Ok(end);
        }
        reel.want(at);
        self.bring_front(reel);
        reel.ready(at).await
    }

    fn reel_of(&self, url: &str) -> Result<(String, Option<Arc<Reel>>), String> {
        let url = source::checked(url)?;
        let name = file_name(url.as_str());
        let path = self.dir.join(&name);
        if path.is_file() {
            mark_used(&path);
            return Ok((name, None));
        }
        let reel = self.desk().take(&self.dir, &name, url.as_str())?;
        Ok((name, Some(reel)))
    }

    fn bring_front(&self, reel: &Arc<Reel>) {
        self.desk().bring_front(reel);
        self.poke.send_replace(());
    }

    fn desk(&self) -> MutexGuard<'_, Desk> {
        match self.desk.lock() {
            Ok(guard) => guard,
            Err(poison) => poison.into_inner(),
        }
    }
}

fn file_name(url: &str) -> String {
    format!("{}.mp4", hex::encode(Sha256::digest(url.as_bytes())))
}

#[cfg(test)]
mod tests {
    use super::file_name;
    use super::server::is_file_name;

    #[test]
    fn names_are_served_hex_hashes_of_the_url() {
        let name = file_name("https://storage.scnative.dev/video/1-1.mp4");
        assert!(is_file_name(&name));
        assert_ne!(
            name,
            file_name("https://storage.scnative.dev/video/1-2.mp4")
        );
    }
}
