use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use voice_audio::OutputInfo;
use voice_audio::routing::same_physical;

use crate::clip::Clip;
use crate::config::SpeakMode;
use crate::event::State;
use crate::machine::{Core, Msg, Phase};
use crate::stream::{Feed, Stream};
use crate::tts::{Piece, Say};
use crate::{models, qwen, speaker, voices};

const TICK: Duration = Duration::from_millis(33);
const SPEECH_INPUT: &str = "speech";
const GRACE: Duration = Duration::from_secs(3);
const STALL: Duration = Duration::from_secs(20);
const BURST: f32 = 0.64;
const HEADROOM: f32 = 1.2;

pub struct Draft {
    rate: u32,
    samples: Vec<f32>,
    expected: f32,
    first: Option<(Instant, usize)>,
}

pub struct Speech {
    pub r#gen: u64,
    rate: u32,
    feed: Option<Feed>,
    levels: Levels,
    samples: usize,
    started: Instant,
    next_tick: Instant,
    until: Instant,
}

struct Levels {
    window: usize,
    sum: f32,
    count: usize,
    done: Vec<f32>,
}

impl Draft {
    fn new(text: &str) -> Draft {
        Draft {
            rate: 0,
            samples: Vec::new(),
            expected: qwen::seconds(text),
            first: None,
        }
    }

    fn take(&mut self, rate: u32, samples: Vec<f32>, now: Instant) {
        if self.first.is_none() {
            self.first = Some((now, samples.len()));
        }
        self.rate = rate;
        self.samples.extend(samples);
    }

    fn ready(&self, now: Instant) -> bool {
        let Some((at, lead)) = self.first else {
            return false;
        };
        let rate = self.rate.max(1) as f32;
        let waited = now.saturating_duration_since(at).as_secs_f32();
        let made = (self.samples.len() - lead) as f32 / rate;
        if made <= 0.0 {
            return false;
        }
        let pace = made / waited.max(0.001);
        let behind = (1.0 - pace).max(0.0) * self.expected * HEADROOM;
        self.samples.len() as f32 / rate >= BURST / pace + behind
    }
}

impl Speech {
    fn new(r#gen: u64, rate: u32, feed: Feed, now: Instant) -> Speech {
        Speech {
            r#gen,
            rate,
            feed: Some(feed),
            levels: Levels::new(rate),
            samples: 0,
            started: now,
            next_tick: now,
            until: now + STALL,
        }
    }

    fn take(&mut self, samples: Vec<f32>, now: Instant) {
        let Some(feed) = &self.feed else {
            return;
        };
        self.levels.push(&samples);
        self.samples += samples.len();
        feed.push(samples);
        self.until = now + STALL;
    }

    fn close(&mut self, now: Instant) {
        self.feed = None;
        let length = Duration::from_secs_f32(self.samples as f32 / self.rate.max(1) as f32);
        self.until = (self.started + length).max(now) + GRACE;
    }

    pub fn deadline(&self) -> Instant {
        self.next_tick.min(self.until)
    }
}

impl Levels {
    fn new(rate: u32) -> Levels {
        Levels {
            window: (rate as usize / 30).max(1),
            sum: 0.0,
            count: 0,
            done: Vec::new(),
        }
    }

    fn push(&mut self, samples: &[f32]) {
        for sample in samples {
            self.sum += sample * sample;
            self.count += 1;
            if self.count == self.window {
                self.done.push((self.sum / self.window as f32).sqrt());
                self.sum = 0.0;
                self.count = 0;
            }
        }
    }
}

fn wait(ended: Receiver<()>, inbox: std::sync::mpsc::Sender<Msg>, msg: Msg) {
    let _ = std::thread::Builder::new()
        .name("voice-spoken".into())
        .spawn(move || {
            let _ = ended.recv();
            let _ = inbox.send(msg);
        });
}

impl Core {
    pub fn say(&mut self, text: String) {
        let source = voices::find(&self.config.speak.voice)
            .and_then(|voice| models::source(&self.deps.store, voice));
        let Some(source) = source else {
            return self.go_idle();
        };
        let r#gen = self.next_gen();
        self.synth = Some(r#gen);
        self.draft = Some(Draft::new(&text));
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.synth);
        self.tts.say(Say {
            r#gen,
            text,
            language: self.config.language,
            source,
            speed: self.config.speak.speed,
            pitch: self.config.speak.pitch,
        });
    }

    pub fn warm_voice(&self) {
        if !self.config.speak.replies {
            return;
        }
        let Some(voice) = voices::find(&self.config.speak.voice) else {
            return;
        };
        if let voices::Kind::Qwen { speaker, .. } = voice.kind
            && let Some(paths) = models::qwen(&self.deps.store, voice)
        {
            self.tts.warm(paths, speaker);
        }
    }

    pub fn synthesized(&mut self, r#gen: u64, piece: Piece) {
        if self.synth != Some(r#gen) {
            return;
        }
        let now = Instant::now();
        match piece {
            Piece::Audio { rate, samples } => self.heard(rate, samples, now),
            Piece::End => {
                self.synth = None;
                self.voiced(now);
            }
            Piece::Failed(error) => {
                self.synth = None;
                self.draft = None;
                self.fail("tts_failed", Some(error));
                self.voiced(now);
            }
        }
    }

    fn heard(&mut self, rate: u32, samples: Vec<f32>, now: Instant) {
        if let Phase::Speaking(speech) = &mut self.phase {
            return speech.take(samples, now);
        }
        let Some(draft) = self.draft.as_mut() else {
            return;
        };
        draft.take(rate, samples, now);
        if draft.ready(now) {
            self.play_speech(now);
        } else {
            self.phase = Phase::Thinking(now + self.deps.timing.synth);
        }
    }

    fn voiced(&mut self, now: Instant) {
        if self.draft.is_some() {
            self.play_speech(now);
        }
        match &mut self.phase {
            Phase::Speaking(speech) => speech.close(now),
            Phase::Thinking(_) => self.go_idle(),
            _ => {}
        }
    }

    fn play_speech(&mut self, now: Instant) {
        let Some(draft) = self.draft.take().filter(|draft| !draft.samples.is_empty()) else {
            return;
        };
        let (feed, stream) = Stream::open(draft.rate);
        let r#gen = self.next_gen();
        match self.route(stream) {
            Ok(ended) => {
                wait(ended, self.inbox.clone(), Msg::Spoken(r#gen));
                self.deps.output.duck(self.config.duck);
                let mut speech = Speech::new(r#gen, draft.rate, feed, now);
                speech.take(draft.samples, now);
                self.phase = Phase::Speaking(Box::new(speech));
                self.emit_state(State::Speaking, None);
            }
            Err(error) => {
                self.fail("tts_failed", Some(error));
                self.go_idle();
            }
        }
    }

    fn route(&mut self, stream: Stream) -> Result<Receiver<()>, String> {
        let device = match self.config.speak.mode {
            SpeakMode::WithMusic => None,
            SpeakMode::Device => Some(self.config.speak.device.clone()),
            SpeakMode::WhereIListen => self.paired_output().map(Some),
        };
        match device {
            None => self.deps.output.speak(stream),
            Some(device) => {
                let (playing, ended) = speaker::play(device, stream)?;
                self.playing = Some(playing);
                Ok(ended)
            }
        }
    }

    fn paired_output(&self) -> Option<String> {
        let input = self.deps.devices.input(self.last_input.as_deref()?)?;
        self.deps
            .devices
            .outputs
            .iter()
            .find(|output| {
                let info = OutputInfo {
                    name: output.name.clone(),
                    transport: output.transport,
                    headphones: false,
                    group: output.group.clone(),
                };
                same_physical(input, &info)
            })
            .map(|output| output.id.clone())
    }

    pub fn spoken(&mut self, r#gen: u64) {
        let current = matches!(&self.phase, Phase::Speaking(speech) if speech.r#gen == r#gen);
        if current {
            self.playing = None;
            self.level(SPEECH_INPUT.into(), 0.0);
            self.go_idle();
        }
    }

    pub fn speech_tick(&mut self, now: Instant) {
        let Phase::Speaking(speech) = &mut self.phase else {
            return;
        };
        if now >= speech.until {
            self.hush();
            return self.go_idle();
        }
        if now < speech.next_tick {
            return;
        }
        let elapsed = now.saturating_duration_since(speech.started);
        let index = (elapsed.as_millis() / TICK.as_millis()) as usize;
        let rms = speech.levels.done.get(index).copied().unwrap_or(0.0);
        speech.next_tick = speech.started + TICK * (index as u32 + 1);
        self.level(SPEECH_INPUT.into(), rms);
    }

    pub fn play_preview(&mut self, wav: &[u8]) {
        let clip = match Clip::from_wav(wav) {
            Ok(clip) => clip,
            Err(error) => return self.fail("tts_failed", Some(error)),
        };
        if self.preview.is_some() {
            self.hush();
        }
        let r#gen = self.next_gen();
        match self.route(Stream::from(clip)) {
            Ok(ended) => {
                wait(ended, self.inbox.clone(), Msg::Previewed(r#gen));
                self.preview = Some(r#gen);
            }
            Err(error) => self.fail("tts_failed", Some(error)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 24000;

    fn chunk(seconds: f32) -> Vec<f32> {
        vec![0.1; (RATE as f32 * seconds) as usize]
    }

    fn draft_after(chunks: &[(f32, f32)]) -> (Draft, Instant) {
        let start = Instant::now();
        let mut draft = Draft::new("Включаю Скриптонита.");
        let mut now = start;
        for (at, seconds) in chunks {
            now = start + Duration::from_secs_f32(*at);
            draft.take(RATE, chunk(*seconds), now);
        }
        (draft, now)
    }

    #[test]
    fn one_piece_is_not_enough_to_know_the_pace() {
        let (draft, now) = draft_after(&[(0.1, 2.0)]);
        assert!(!draft.ready(now));
    }

    #[test]
    fn a_fast_engine_starts_after_a_short_lead() {
        let (draft, now) = draft_after(&[(0.05, 0.08), (0.09, 0.16), (0.17, 0.32)]);
        assert!(draft.ready(now));
    }

    #[test]
    fn a_real_time_engine_waits_for_one_full_burst() {
        let early = [(0.1, 0.08), (0.26, 0.16), (0.58, 0.32)];
        let (draft, now) = draft_after(&early);
        assert!(!draft.ready(now));
        let later = [(0.1, 0.08), (0.26, 0.16), (0.58, 0.32), (1.22, 0.64)];
        let (draft, now) = draft_after(&later);
        assert!(draft.ready(now));
    }

    #[test]
    fn a_slow_engine_buffers_most_of_the_phrase() {
        let slow = [(0.2, 0.08), (0.52, 0.16), (1.16, 0.32), (2.44, 0.64)];
        let (draft, now) = draft_after(&slow);
        assert!(!draft.ready(now));
    }

    #[test]
    fn levels_follow_the_loudness_across_chunks() {
        let mut levels = Levels::new(RATE);
        levels.push(&vec![0.5; 400]);
        levels.push(&vec![0.5; 400]);
        levels.push(&vec![0.0; 800]);
        assert_eq!(levels.done.len(), 2);
        assert!((levels.done[0] - 0.5).abs() < 1e-4);
        assert_eq!(levels.done[1], 0.0);
    }
}
