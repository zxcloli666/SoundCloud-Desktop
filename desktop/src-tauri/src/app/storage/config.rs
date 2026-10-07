use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

const CONFIG_FILE: &str = "storage_location.json";

#[derive(Default, Serialize, Deserialize)]
pub struct LocationConfig {
    #[serde(default)]
    pub audio_root: Option<PathBuf>,
    #[serde(default)]
    pub stale_roots: Vec<PathBuf>,
    #[serde(default)]
    pub fallback_roots: Vec<PathBuf>,
}

pub fn config_path(data_dir: &Path) -> PathBuf {
    data_dir.join(CONFIG_FILE)
}

pub fn load(path: &Path) -> LocationConfig {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save(path: &Path, config: &LocationConfig) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec_pretty(config).map_err(std::io::Error::other)?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)
}
