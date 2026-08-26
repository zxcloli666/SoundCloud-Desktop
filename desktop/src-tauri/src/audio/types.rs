use std::num::NonZero;
use std::sync::mpsc::Sender;

use rodio::mixer::Mixer;

pub const EQ_BANDS: usize = 10;
pub const EQ_FREQS: [f64; EQ_BANDS] = [
    32.0, 64.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0,
];
pub const EQ_Q: f64 = 1.414;
// Eight seconds is enough for stable gated loudness while keeping a first
// uncached play responsive. The previous 30-second pre-decode blocked startup.
pub const NORMALIZATION_ANALYSIS_SAMPLES: usize = 48_000 * 2 * 8;
pub const NORMALIZATION_BLOCK_SAMPLES: usize = 48_000 * 2 / 2;
pub const NORMALIZATION_TARGET_RMS: f64 = 0.14;
pub const NORMALIZATION_TARGET_PEAK: f64 = 0.95;
pub const NORMALIZATION_MAX_BOOST_DB: f64 = 9.0;
pub const NORMALIZATION_MAX_ATTENUATION_DB: f64 = -8.0;
pub const TICK_INTERVAL_MS: u64 = 100;

pub type ChannelCount = NonZero<u16>;
pub type SampleRate = NonZero<u32>;

pub struct EqParams {
    pub enabled: bool,
    pub gains: [f64; EQ_BANDS],
}

impl Default for EqParams {
    fn default() -> Self {
        Self {
            enabled: false,
            gains: [0.0; EQ_BANDS],
        }
    }
}

// Все варианты — это команды на установку state у системного медиа-контроллера
// (MPRIS/SMTC), общий `Set`-префикс отражает это назначение, не редандант.
#[allow(clippy::enum_variant_names)]
pub enum MediaCmd {
    SetMetadata {
        title: String,
        artist: String,
        cover_url: Option<String>,
        duration_secs: f64,
    },
    SetPlaying(bool),
    SetPosition(f64),
}

pub enum AudioThreadCmd {
    SwitchDevice {
        name: Option<String>,
        reply: Sender<Result<Mixer, String>>,
    },
    Reconnect,
}

#[derive(serde::Serialize)]
pub struct AudioLoadResult {
    pub duration_secs: Option<f64>,
}

#[derive(serde::Serialize)]
pub struct AudioStreamLoadResult {
    pub duration_secs: Option<f64>,
    pub quality: String,
    pub source: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStreamRequest {
    pub urn: String,
    #[serde(default)]
    pub urls: Vec<String>,
    #[serde(default)]
    pub download_urls: Vec<String>,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub hq: bool,
    #[serde(default)]
    pub duration_ms: Option<u64>,
}

#[derive(serde::Serialize, Clone)]
pub struct AudioSink {
    pub name: String,
    pub description: String,
    pub is_default: bool,
}

pub const STALL_THRESHOLD_MS: u64 = 2_000;
pub const STALL_COOLDOWN_MS: u64 = 10_000;
/// After a device switch/reconnect the new output can take a moment to start
/// pulling samples (Bluetooth especially); suppress stall-detection for this long
/// so the settling gap isn't mistaken for a dead stream.
pub const STALL_SUPPRESS_MS: u64 = 4_000;

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsTimingLine {
    pub time_secs: f64,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct FloatingCommentEvent {
    pub id: i64,
    pub body: String,
    pub timestamp_ms: u64,
    pub user_avatar_url: Option<String>,
}
