use std::path::{Path, PathBuf};

use rodio::Source;
use tauri::Manager;

use crate::audio::decode::{analysis_cache_file, open_source};
use crate::audio::state::AudioState;
use crate::rt::AppHandle;

const CACHE_VERSION: &str = "1";
const CACHE_EXTENSION: &str = "silence";
const WINDOW_SECS: f64 = 0.05;
const THRESHOLD_POWER: f64 = 1e-5;
const MIN_EDGE_SECS: f64 = 1.5;
const LEAD_PAD_SECS: f64 = 0.05;
const TAIL_PAD_SECS: f64 = 0.3;
const LEAD_SLACK_SECS: f64 = 0.25;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct SilenceEdges {
    pub lead: Option<f64>,
    pub tail: Option<f64>,
}

#[derive(Debug, PartialEq)]
pub enum SilenceJump {
    To(f64),
    End,
}

#[derive(Default)]
pub struct SilenceState {
    enabled: bool,
    track: u64,
    scanned_track: Option<u64>,
    cache_file: Option<PathBuf>,
    edges: Option<SilenceEdges>,
}

impl SilenceState {
    pub fn start_track(&mut self, cache_file: Option<PathBuf>) {
        self.track += 1;
        self.scanned_track = None;
        self.cache_file = cache_file;
        self.edges = None;
    }

    pub fn jump(&self, pos: f64) -> Option<SilenceJump> {
        if !self.enabled {
            return None;
        }
        let edges = self.edges?;
        if edges.tail.is_some_and(|tail| pos >= tail) {
            return Some(SilenceJump::End);
        }
        edges
            .lead
            .filter(|lead| pos < lead - LEAD_SLACK_SECS)
            .map(SilenceJump::To)
    }
}

pub fn cache_file(cache_dir: Option<&Path>, cache_key: Option<&str>) -> Option<PathBuf> {
    Some(analysis_cache_file(cache_dir?, cache_key?, CACHE_EXTENSION))
}

pub fn set_enabled(app: &AppHandle, enabled: bool) {
    app.state::<AudioState>().silence.lock().unwrap().enabled = enabled;
    if enabled {
        scan(app);
    }
}

pub fn scan(app: &AppHandle) {
    let state = app.state::<AudioState>();
    let (track, cache_file) = {
        let mut silence = state.silence.lock().unwrap();
        if !silence.enabled || silence.scanned_track == Some(silence.track) {
            return;
        }
        silence.scanned_track = Some(silence.track);
        (silence.track, silence.cache_file.clone())
    };
    let Some(bytes) = state.source_bytes.lock().unwrap().clone() else {
        return;
    };
    let app = app.clone();
    std::thread::Builder::new()
        .name("silence-scan".into())
        .spawn(move || {
            let edges = read_cache(cache_file.as_deref()).or_else(|| {
                let edges = analyze(&bytes)?;
                write_cache(cache_file.as_deref(), edges);
                Some(edges)
            });
            let state = app.state::<AudioState>();
            let mut silence = state.silence.lock().unwrap();
            if silence.track == track {
                silence.edges = edges;
            }
        })
        .ok();
}

fn analyze(bytes: &[u8]) -> Option<SilenceEdges> {
    let source = open_source(bytes).ok()?;
    let channels = source.channels().get() as usize;
    let rate = source.sample_rate().get() as f64;
    Some(find_edges(source, channels, rate))
}

fn find_edges(samples: impl Iterator<Item = f32>, channels: usize, rate: f64) -> SilenceEdges {
    let window = ((rate * WINDOW_SECS) as usize).max(1) * channels;
    let window_secs = (window / channels) as f64 / rate;
    let mut first = None;
    let mut last = None;
    let mut index = 0;
    let mut sum = 0.0;
    let mut count = 0;
    let mut total = 0;

    for sample in samples {
        let value = sample as f64;
        sum += value * value;
        count += 1;
        total += 1;
        if count == window {
            if sum / count as f64 > THRESHOLD_POWER {
                first.get_or_insert(index);
                last = Some(index);
            }
            index += 1;
            sum = 0.0;
            count = 0;
        }
    }
    if count > 0 && sum / count as f64 > THRESHOLD_POWER {
        first.get_or_insert(index);
        last = Some(index);
    }

    let (Some(first), Some(last)) = (first, last) else {
        return SilenceEdges::default();
    };
    let duration = (total / channels) as f64 / rate;
    let lead = (first as f64 * window_secs - LEAD_PAD_SECS).max(0.0);
    let tail = ((last + 1) as f64 * window_secs + TAIL_PAD_SECS).min(duration);
    SilenceEdges {
        lead: (lead >= MIN_EDGE_SECS).then_some(lead),
        tail: (duration - tail >= MIN_EDGE_SECS).then_some(tail),
    }
}

fn format_edge(edge: Option<f64>) -> String {
    edge.map(|value| format!("{value:.3}")).unwrap_or_default()
}

fn parse_edge(raw: &str) -> Option<Option<f64>> {
    if raw.is_empty() {
        return Some(None);
    }
    raw.parse::<f64>().ok().map(Some)
}

fn encode(edges: SilenceEdges) -> String {
    format!(
        "{CACHE_VERSION}:{}:{}",
        format_edge(edges.lead),
        format_edge(edges.tail)
    )
}

fn decode(raw: &str) -> Option<SilenceEdges> {
    let mut parts = raw.trim().split(':');
    if parts.next()? != CACHE_VERSION {
        return None;
    }
    let lead = parse_edge(parts.next()?)?;
    let tail = parse_edge(parts.next()?)?;
    parts.next().is_none().then_some(SilenceEdges { lead, tail })
}

fn read_cache(path: Option<&Path>) -> Option<SilenceEdges> {
    decode(&std::fs::read_to_string(path?).ok()?)
}

fn write_cache(path: Option<&Path>, edges: SilenceEdges) {
    let Some(path) = path else {
        return;
    };
    if path.parent().is_some_and(|dir| std::fs::create_dir_all(dir).is_err()) {
        return;
    }
    let _ = std::fs::write(path, encode(edges));
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: f64 = 1000.0;

    fn track(parts: &[(f64, f32)]) -> Vec<f32> {
        parts
            .iter()
            .flat_map(|&(secs, amplitude)| {
                (0..(secs * RATE) as usize).flat_map(move |i| {
                    let value = amplitude * if i % 2 == 0 { 1.0 } else { -1.0 };
                    [value, value]
                })
            })
            .collect()
    }

    fn edges_of(parts: &[(f64, f32)]) -> SilenceEdges {
        find_edges(track(parts).into_iter(), 2, RATE)
    }

    fn close(value: Option<f64>, expected: f64) -> bool {
        value.is_some_and(|value| (value - expected).abs() < 0.06)
    }

    #[test]
    fn finds_leading_and_trailing_silence() {
        let edges = edges_of(&[(3.0, 0.0), (5.0, 0.5), (4.0, 0.0)]);
        assert!(close(edges.lead, 2.95), "{edges:?}");
        assert!(close(edges.tail, 8.3), "{edges:?}");
    }

    #[test]
    fn ignores_short_edges_and_quiet_noise_counts_as_silence() {
        let edges = edges_of(&[(1.0, 0.0), (5.0, 0.5), (1.0, 0.0)]);
        assert_eq!(edges, SilenceEdges::default());
        let edges = edges_of(&[(2.0, 0.001), (5.0, 0.5)]);
        assert!(close(edges.lead, 1.95), "{edges:?}");
    }

    #[test]
    fn keeps_pauses_in_the_middle() {
        let edges = edges_of(&[(5.0, 0.5), (10.0, 0.0), (5.0, 0.5)]);
        assert_eq!(edges, SilenceEdges::default());
    }

    #[test]
    fn silent_track_has_no_edges() {
        assert_eq!(edges_of(&[(6.0, 0.0)]), SilenceEdges::default());
    }

    #[test]
    fn jumps_over_the_lead_and_ends_at_the_tail() {
        let mut state = SilenceState {
            enabled: true,
            edges: Some(SilenceEdges {
                lead: Some(3.0),
                tail: Some(60.0),
            }),
            ..SilenceState::default()
        };
        assert_eq!(state.jump(0.1), Some(SilenceJump::To(3.0)));
        assert_eq!(state.jump(3.0), None);
        assert_eq!(state.jump(30.0), None);
        assert_eq!(state.jump(60.0), Some(SilenceJump::End));
        state.enabled = false;
        assert_eq!(state.jump(0.1), None);
        state.enabled = true;
        state.start_track(None);
        assert_eq!(state.jump(0.1), None);
    }

    #[test]
    fn cache_round_trips() {
        let edges = SilenceEdges {
            lead: Some(2.5),
            tail: None,
        };
        assert_eq!(decode(&encode(edges)), Some(edges));
        assert_eq!(decode(&encode(SilenceEdges::default())), Some(SilenceEdges::default()));
        assert_eq!(decode("0:1:2"), None);
        assert_eq!(decode("1:x:"), None);
    }
}
