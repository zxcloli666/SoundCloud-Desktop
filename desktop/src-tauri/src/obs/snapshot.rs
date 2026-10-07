use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

#[derive(Clone, Default, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NowPlaying {
    pub has_track: bool,
    pub title: String,
    pub artist: String,
    pub url: Option<String>,
    pub artwork_url: Option<String>,
    pub cover_key: Option<String>,
    pub duration_ms: u64,
    pub position_ms: u64,
    pub playing: bool,
    pub accent: String,
}

#[derive(Clone, Default)]
pub struct Snapshot {
    pub np: NowPlaying,
    pub seq: u64,
    pub updated_at: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicView<'a> {
    has_track: bool,
    title: &'a str,
    artist: &'a str,
    url: Option<&'a str>,
    cover_url: Option<String>,
    duration_ms: u64,
    position_ms: u64,
    playing: bool,
    accent: &'a str,
    updated_at: u64,
    seq: u64,
}

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default()
}

fn cover_tag(np: &NowPlaying) -> Option<u64> {
    let source = np.artwork_url.as_deref()?;
    Some(source.bytes().fold(0xcbf29ce484222325u64, |hash, byte| {
        (hash ^ byte as u64).wrapping_mul(0x100000001b3)
    }))
}

impl Snapshot {
    pub fn next(&self, np: NowPlaying) -> Self {
        Self {
            np,
            seq: self.seq + 1,
            updated_at: now_ms(),
        }
    }

    pub fn view(&self, origin: &str) -> PublicView<'_> {
        let np = &self.np;
        PublicView {
            has_track: np.has_track,
            title: &np.title,
            artist: &np.artist,
            url: np.url.as_deref(),
            cover_url: cover_tag(np).map(|tag| format!("{origin}/cover?v={tag:x}")),
            duration_ms: np.duration_ms,
            position_ms: np.position_ms,
            playing: np.playing,
            accent: &np.accent,
            updated_at: self.updated_at,
            seq: self.seq,
        }
    }
}
