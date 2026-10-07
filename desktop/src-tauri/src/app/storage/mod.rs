mod commands;
mod config;
mod relocate;

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::AtomicBool;

pub use commands::*;
use config::LocationConfig;

const AUDIO_DIR: &str = "audio";
const LIKED_DIR: &str = "audio_liked";
const INCOMING_DIR: &str = "audio_incoming";
const PROBE_FILE: &str = ".write-probe";

pub struct AudioDirs {
    pub audio: PathBuf,
    pub liked: PathBuf,
    pub incoming: PathBuf,
}

impl AudioDirs {
    pub fn under(root: &Path) -> Self {
        Self {
            audio: root.join(AUDIO_DIR),
            liked: root.join(LIKED_DIR),
            incoming: root.join(INCOMING_DIR),
        }
    }

    fn all(&self) -> [&PathBuf; 3] {
        [&self.audio, &self.liked, &self.incoming]
    }

    fn create(&self) -> std::io::Result<()> {
        for dir in self.all() {
            std::fs::create_dir_all(dir)?;
        }
        Ok(())
    }
}

pub struct StorageLocation {
    config_path: PathBuf,
    config_lock: Mutex<()>,
    default_root: PathBuf,
    active_root: PathBuf,
    configured_root: Option<PathBuf>,
    relocating: AtomicBool,
}

impl StorageLocation {
    pub fn init(cache_dir: &Path, data_dir: &Path) -> Self {
        let config_path = config::config_path(data_dir);
        let configured_root = config::load(&config_path).audio_root;
        let active_root = configured_root
            .as_deref()
            .filter(|root| is_usable_root(root))
            .unwrap_or(cache_dir)
            .to_path_buf();
        AudioDirs::under(&active_root).create().ok();
        Self {
            config_path,
            config_lock: Mutex::new(()),
            default_root: cache_dir.to_path_buf(),
            active_root,
            configured_root,
            relocating: AtomicBool::new(false),
        }
    }

    pub fn audio_dirs(&self) -> AudioDirs {
        AudioDirs::under(&self.active_root)
    }

    pub fn is_unavailable(&self) -> bool {
        self.configured_root
            .as_ref()
            .is_some_and(|root| *root != self.active_root)
    }

    pub fn sweep_stale_roots(&self) {
        let _guard = self.config_lock.lock();
        let mut config = config::load(&self.config_path);
        if config.stale_roots.is_empty() {
            return;
        }
        let before = config.stale_roots.len();
        config.stale_roots.retain(|root| {
            if *root == self.active_root || self.configured_root.as_ref() == Some(root) {
                return false;
            }
            if !root.is_dir() {
                return true;
            }
            relocate::remove_cache_files(&AudioDirs::under(root));
            if *root != self.default_root {
                std::fs::remove_dir(root).ok();
            }
            false
        });
        if config.stale_roots.len() != before {
            config::save(&self.config_path, &config).ok();
        }
    }

    fn commit(&self, target_root: &Path) -> std::io::Result<()> {
        let _guard = self.config_lock.lock();
        let mut config = config::load(&self.config_path);
        let mut stale: Vec<PathBuf> = std::mem::take(&mut config.stale_roots);
        stale.push(self.active_root.clone());
        stale.retain(|root| root != target_root);
        stale.sort();
        stale.dedup();
        let audio_root = (target_root != self.default_root).then(|| target_root.to_path_buf());
        config::save(
            &self.config_path,
            &LocationConfig {
                audio_root,
                stale_roots: stale,
            },
        )
    }
}

fn is_usable_root(root: &Path) -> bool {
    root.is_dir() && AudioDirs::under(root).create().is_ok() && probe_writable(root)
}

fn probe_writable(root: &Path) -> bool {
    let probe = root.join(PROBE_FILE);
    let ok = std::fs::write(&probe, b"ok").is_ok();
    std::fs::remove_file(&probe).ok();
    ok
}
