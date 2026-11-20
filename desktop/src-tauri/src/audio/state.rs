use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex};

use rodio::mixer::Mixer;
use rodio::Player;

use crate::audio::analyser::AnalyserBuffer;
use crate::audio::crossfade::CrossfadeState;
use crate::audio::master::Master;
use crate::audio::preview::PreviewState;
use crate::audio::output::{spawn_output_thread, OutputHandles};
use crate::audio::silence::SilenceState;
use crate::audio::sound::Sound;
use crate::audio::types::{
    AudioThreadCmd, FloatingCommentEvent, LyricsTimingLine, MediaCmd,
};
use crate::rt::AppHandle;

pub struct LyricsTimelineState {
    pub lines: Vec<LyricsTimingLine>,
    pub active_index: Option<usize>,
}

pub struct CommentsTimelineState {
    pub comments: Vec<FloatingCommentEvent>,
    pub next_index: usize,
}

pub struct AudioState {
    pub player: Mutex<Option<Player>>,
    pub mixer: Arc<Mutex<Mixer>>,
    pub sound: Mutex<Sound>,
    pub normalization_enabled: AtomicBool,
    pub normalization_gain: Mutex<f32>,
    pub volume: Mutex<f32>,
    pub playback_rate: Mutex<f32>,
    /// Source-time position integrator `(source_anchor, output_anchor)` in seconds.
    /// rodio's get_pos() is wall-clock (output) time; source time is integrated as
    /// `source_anchor + (get_pos() - output_anchor) * rate`. The anchor is re-based on
    /// load/seek/loop and on every rate change so speed changes mid-track stay exact.
    pub pos_anchor: Mutex<(f64, f64)>,
    pub has_track: AtomicBool,
    pub ended_notified: AtomicBool,
    pub suppress_ended_until_ms: AtomicU64,
    /// Wall-clock ms until which the tick thread skips stall-detection — set around
    /// device switch/reconnect so a settling output isn't read as a dead stream.
    pub suppress_stall_until_ms: AtomicU64,
    pub device_error: Arc<AtomicBool>,
    pub device_reconnected: Arc<AtomicBool>,
    pub load_gen: AtomicU64,
    pub media_tx: Mutex<Option<std::sync::mpsc::Sender<MediaCmd>>>,
    pub audio_tx: std::sync::mpsc::Sender<AudioThreadCmd>,
    pub source_bytes: Mutex<Option<Vec<u8>>>,
    pub follow_default_output: Arc<AtomicBool>,
    pub active_output: Arc<Mutex<Option<String>>>,
    pub last_known_default_output: Mutex<Option<String>>,
    pub lyrics_timeline: Mutex<Option<LyricsTimelineState>>,
    pub comments_timeline: Mutex<Option<CommentsTimelineState>>,
    /// A-B loop region `(a, b)` in **source seconds** (a < b). When set, playback
    /// jumps back to `a` once it crosses `b` (see tick.rs). None = disabled.
    pub ab_loop: Mutex<Option<(f64, f64)>>,
    pub silence: Mutex<SilenceState>,
    pub analyser_buffer: Arc<AnalyserBuffer>,
    pub preview: Mutex<PreviewState>,
    pub crossfade: Mutex<CrossfadeState>,
    pub master: Arc<Master>,
}

pub fn init(app: &AppHandle) -> AudioState {
    let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<AudioThreadCmd>();
    let device_error_flag = Arc::new(AtomicBool::new(false));
    let reconnected_flag = Arc::new(AtomicBool::new(false));
    let follow_default_output = Arc::new(AtomicBool::new(true));
    let active_output = Arc::new(Mutex::new(None));
    let master = Master::new();

    let shared_mixer = spawn_output_thread(
        OutputHandles {
            app: app.clone(),
            cmd_tx: cmd_tx.clone(),
            error_flag: device_error_flag.clone(),
            reconnected: reconnected_flag.clone(),
            follow_default_output: follow_default_output.clone(),
            active_output: active_output.clone(),
            master: master.clone(),
        },
        cmd_rx,
    );

    AudioState {
        player: Mutex::new(None),
        mixer: shared_mixer,
        sound: Mutex::new(Sound::new()),
        normalization_enabled: AtomicBool::new(true),
        normalization_gain: Mutex::new(1.0),
        volume: Mutex::new(0.25),
        playback_rate: Mutex::new(1.0),
        pos_anchor: Mutex::new((0.0, 0.0)),
        has_track: AtomicBool::new(false),
        ended_notified: AtomicBool::new(false),
        suppress_ended_until_ms: AtomicU64::new(0),
        suppress_stall_until_ms: AtomicU64::new(0),
        device_error: device_error_flag,
        device_reconnected: reconnected_flag,
        load_gen: AtomicU64::new(0),
        media_tx: Mutex::new(None),
        audio_tx: cmd_tx,
        source_bytes: Mutex::new(None),
        follow_default_output,
        active_output,
        last_known_default_output: Mutex::new(None),
        lyrics_timeline: Mutex::new(None),
        comments_timeline: Mutex::new(None),
        ab_loop: Mutex::new(None),
        silence: Mutex::new(SilenceState::default()),
        analyser_buffer: AnalyserBuffer::new(),
        preview: Mutex::new(PreviewState::default()),
        crossfade: Mutex::new(CrossfadeState::default()),
        master,
    }
}
