use std::io::Write;
use std::path::Path;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

pub const ACCOUNTS_FILE: &str = "scrobble_accounts.json";
pub const QUEUE_FILE: &str = "scrobble_queue.json";
const QUEUE_LIMIT: usize = 3000;

#[derive(Clone, Serialize, Deserialize)]
pub struct Scrobble {
    pub artist: String,
    pub title: String,
    pub timestamp: i64,
    pub duration_secs: Option<u32>,
    pub url: Option<String>,
}

#[derive(Clone, Default, Serialize, Deserialize)]
pub struct Profile {
    pub name: String,
    pub url: Option<String>,
    pub image: Option<String>,
    pub playcount: Option<u64>,
    pub since: Option<i64>,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct LastfmAccount {
    pub key: String,
    pub profile: Profile,
}

#[derive(Clone, Serialize, Deserialize)]
pub struct ListenbrainzAccount {
    pub token: String,
    pub profile: Profile,
}

#[derive(Default, Serialize, Deserialize)]
pub struct Accounts {
    pub lastfm: Option<LastfmAccount>,
    pub listenbrainz: Option<ListenbrainzAccount>,
}

#[derive(Default, Serialize, Deserialize)]
pub struct Queue {
    #[serde(default)]
    pub lastfm: Vec<Scrobble>,
    #[serde(default)]
    pub listenbrainz: Vec<Scrobble>,
}

impl Queue {
    pub fn push(list: &mut Vec<Scrobble>, item: Scrobble) {
        list.push(item);
        if list.len() > QUEUE_LIMIT {
            let excess = list.len() - QUEUE_LIMIT;
            list.drain(..excess);
        }
    }
}

pub fn load<T: DeserializeOwned + Default>(path: &Path) -> T {
    std::fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

pub fn save<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let bytes = serde_json::to_vec(value).map_err(std::io::Error::other)?;
    let tmp = path.with_extension(format!("tmp-{}", std::process::id()));
    {
        let mut file = std::fs::File::create(&tmp)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
    }
    std::fs::rename(&tmp, path).inspect_err(|_| {
        let _ = std::fs::remove_file(&tmp);
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(timestamp: i64) -> Scrobble {
        Scrobble {
            artist: "a".into(),
            title: "t".into(),
            timestamp,
            duration_secs: None,
            url: None,
        }
    }

    #[test]
    fn queue_keeps_newest_when_full() {
        let mut list = Vec::new();
        for ts in 0..(QUEUE_LIMIT as i64 + 5) {
            Queue::push(&mut list, item(ts));
        }
        assert_eq!(list.len(), QUEUE_LIMIT);
        assert_eq!(list[0].timestamp, 5);
    }

    #[test]
    fn save_and_load_round_trip() {
        let dir = std::env::temp_dir().join(format!("scrobble-test-{}", std::process::id()));
        let path = dir.join(QUEUE_FILE);
        let mut queue = Queue::default();
        Queue::push(&mut queue.lastfm, item(42));
        save(&path, &queue).unwrap();
        let loaded: Queue = load(&path);
        assert_eq!(loaded.lastfm[0].timestamp, 42);
        assert!(loaded.listenbrainz.is_empty());
        std::fs::remove_dir_all(dir).ok();
    }
}
