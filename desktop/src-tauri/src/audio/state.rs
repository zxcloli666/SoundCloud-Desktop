use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::{Arc, Mutex, RwLock};
use std::time::Duration;

use rodio::mixer::Mixer;
use rodio::Player;

use crate::audio::analyser::AnalyserBuffer;
use crate::audio::device::open_device_sink;
use crate::audio::streaming::ActiveStream;
use crate::audio::types::{
    AudioThreadCmd, EqParams, FloatingCommentEvent, LyricsTimingLine, MediaCmd,
};

pub struct LyricsTimelineState {
    pub lines: Vec<LyricsTimingLine>,
    pub active_index: Option<usize>,
}

pub struct CommentsTimelineState {
    pub comments: Vec<FloatingCommentEvent>,
    pub next_index: usize,
}

/// Lightweight hover-preview channel: a second rodio `Player` on the shared mixer
/// with its own throwaway analyser (so it never disturbs the main player's spectrum)
/// and a tick-driven linear volume ramp for fade-in/out. Never writes plays history.
pub struct PreviewState {
    pub player: Option<Player>,
    /// Currently applied volume (rodio scale 0.0..2.0).
    pub volume: f32,
    /// Target volume the tick-thread ramp is moving toward.
    pub target: f32,
    /// Per-tick volume delta magnitude (>= 0); direction derived from volume vs target.
    pub step: f32,
    /// When the ramp reaches 0, stop and drop the player (fade-out).
    pub stop_at_zero: bool,
    /// Monotonic generation of the installed preview. A newer hover bumps it; a
    /// stale stop / out-of-order decode is rejected by comparing against it so
    /// rapid hover across tiles can't clobber the surviving preview.
    pub r#gen: u64,
}

pub struct AudioState {
    pub player: Mutex<Option<Player>>,
    pub mixer: Arc<Mutex<Mixer>>,
    pub eq_params: Arc<RwLock<EqParams>>,
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
    /// Immutable complete source shared by seek/reconnect rebuilds. Keeping this
    /// behind an `Arc` makes taking a rebuild snapshot O(1) instead of cloning an
    /// entire track while the audio thread is recovering.
    pub source_bytes: Mutex<Option<Arc<[u8]>>>,
    /// The growing source behind the fast-start player. Kept separately so seek can
    /// probe a fresh reader without touching the live decoder.
    pub(crate) active_stream: Mutex<Option<ActiveStream>>,
    /// Background producer feeding the growing fast-start buffer. Aborted on
    /// track changes so a skipped track cannot keep consuming bandwidth.
    pub stream_task: Mutex<Option<tokio::task::JoinHandle<()>>>,
    pub follow_default_output: AtomicBool,
    pub last_known_default_output: Mutex<Option<String>>,
    pub lyrics_timeline: Mutex<Option<LyricsTimelineState>>,
    pub comments_timeline: Mutex<Option<CommentsTimelineState>>,
    /// A-B loop region `(a, b)` in **source seconds** (a < b). When set, playback
    /// jumps back to `a` once it crosses `b` (see tick.rs). None = disabled.
    pub ab_loop: Mutex<Option<(f64, f64)>>,
    pub analyser_buffer: Arc<AnalyserBuffer>,
    pub preview: Mutex<PreviewState>,
}

pub fn init() -> AudioState {
    let (mixer_tx, mixer_rx) = std::sync::mpsc::channel::<Arc<Mutex<Mixer>>>();
    let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<AudioThreadCmd>();
    let device_error_flag = Arc::new(AtomicBool::new(false));
    let reconnected_flag = Arc::new(AtomicBool::new(false));

    let cmd_tx_for_thread = cmd_tx.clone();
    let reconnected_for_thread = reconnected_flag.clone();
    let error_flag_for_thread = device_error_flag.clone();
    std::thread::Builder::new()
        .name("audio-output".into())
        .spawn(move || {
            let cmd_tx = cmd_tx_for_thread;
            let reconnected = reconnected_for_thread;
            let error_flag = error_flag_for_thread;
            let mut device_sink =
                open_device_sink(None, &cmd_tx, &error_flag).expect("no audio output device");
            let shared_mixer = Arc::new(Mutex::new(device_sink.mixer().clone()));
            mixer_tx.send(shared_mixer.clone()).ok();

            loop {
                match cmd_rx.recv() {
                    Ok(AudioThreadCmd::SwitchDevice { name, reply }) => {
                        drop(device_sink);

                        match open_device_sink(name.as_deref(), &cmd_tx, &error_flag) {
                            Ok(new_sink) => {
                                let mixer = new_sink.mixer().clone();
                                *shared_mixer.lock().unwrap() = mixer.clone();
                                device_sink = new_sink;
                                reply.send(Ok(mixer)).ok();
                            }
                            Err(error) => {
                                device_sink = open_device_sink(None, &cmd_tx, &error_flag)
                                    .expect("no audio output device");
                                *shared_mixer.lock().unwrap() = device_sink.mixer().clone();
                                reply.send(Err(error)).ok();
                            }
                        }
                    }
                    Ok(AudioThreadCmd::Reconnect) => {
                        eprintln!("[audio] device invalidated, reconnecting...");
                        std::thread::sleep(Duration::from_millis(500));

                        drop(device_sink);
                        match open_device_sink(None, &cmd_tx, &error_flag) {
                            Ok(new_sink) => {
                                *shared_mixer.lock().unwrap() = new_sink.mixer().clone();
                                device_sink = new_sink;
                                reconnected.store(true, std::sync::atomic::Ordering::Release);
                                eprintln!("[audio] reconnected successfully");
                            }
                            Err(error) => {
                                eprintln!("[audio] reconnect failed: {error}, retrying...");
                                std::thread::sleep(Duration::from_secs(1));
                                device_sink = open_device_sink(None, &cmd_tx, &error_flag)
                                    .expect("no audio output device");
                                *shared_mixer.lock().unwrap() = device_sink.mixer().clone();
                                reconnected.store(true, std::sync::atomic::Ordering::Release);
                            }
                        }
                    }
                    Err(_) => break,
                }
            }
        })
        .expect("failed to spawn audio thread");

    let shared_mixer = mixer_rx.recv().expect("audio thread failed to init");

    AudioState {
        player: Mutex::new(None),
        mixer: shared_mixer,
        eq_params: Arc::new(RwLock::new(EqParams::default())),
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
        active_stream: Mutex::new(None),
        stream_task: Mutex::new(None),
        follow_default_output: AtomicBool::new(true),
        last_known_default_output: Mutex::new(None),
        lyrics_timeline: Mutex::new(None),
        comments_timeline: Mutex::new(None),
        ab_loop: Mutex::new(None),
        analyser_buffer: AnalyserBuffer::new(),
        preview: Mutex::new(PreviewState {
            player: None,
            volume: 0.0,
            target: 0.0,
            step: 0.0,
            stop_at_zero: false,
            r#gen: 0,
        }),
    }
}
