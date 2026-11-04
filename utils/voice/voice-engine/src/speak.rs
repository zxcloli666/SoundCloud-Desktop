use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use voice_audio::OutputInfo;
use voice_audio::routing::same_physical;

use crate::clip::Clip;
use crate::config::SpeakMode;
use crate::event::State;
use crate::machine::{Core, Msg, Phase};
use crate::tts::Job;
use crate::{models, speaker, voices};

const TICK: Duration = Duration::from_millis(33);
const SPEECH_INPUT: &str = "speech";
const GRACE: Duration = Duration::from_secs(3);

pub struct Speech {
    pub r#gen: u64,
    levels: Vec<f32>,
    started: Instant,
    next_tick: Instant,
    until: Instant,
}

impl Speech {
    pub fn deadline(&self) -> Instant {
        self.next_tick.min(self.until)
    }
}

fn levels(clip: &Clip) -> Vec<f32> {
    let window = (clip.rate as usize / 30).max(1);
    clip.samples
        .chunks(window)
        .map(|chunk| (chunk.iter().map(|s| s * s).sum::<f32>() / chunk.len() as f32).sqrt())
        .collect()
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
        let Some(voice) = voices::find(&self.config.speak.voice) else {
            return self.go_idle();
        };
        let Some(dir) = models::dir(&self.deps.store, voice.model) else {
            return self.go_idle();
        };
        let r#gen = self.next_gen();
        self.synth = Some(r#gen);
        self.phase = Phase::Thinking(Instant::now() + self.deps.timing.synth);
        self.tts.say(Job {
            r#gen,
            text,
            language: self.config.language,
            voice,
            dir,
            speed: self.config.speak.speed,
            pitch: self.config.speak.pitch,
        });
    }

    pub fn synthesized(&mut self, r#gen: u64, result: Result<Clip, String>) {
        if self.synth != Some(r#gen) {
            return;
        }
        self.synth = None;
        match result {
            Ok(clip) => self.play_speech(clip),
            Err(error) => {
                self.fail("tts_failed", Some(error));
                self.go_idle();
            }
        }
    }

    fn play_speech(&mut self, clip: Clip) {
        let r#gen = self.next_gen();
        let levels = levels(&clip);
        let seconds = Duration::from_secs_f32(clip.seconds());
        match self.route(clip) {
            Ok(ended) => {
                wait(ended, self.inbox.clone(), Msg::Spoken(r#gen));
                self.deps.output.duck(self.config.duck);
                let started = Instant::now();
                self.phase = Phase::Speaking(Box::new(Speech {
                    r#gen,
                    levels,
                    started,
                    next_tick: started,
                    until: started + seconds + GRACE,
                }));
                self.emit_state(State::Speaking, None);
            }
            Err(error) => {
                self.fail("tts_failed", Some(error));
                self.go_idle();
            }
        }
    }

    fn route(&mut self, clip: Clip) -> Result<Receiver<()>, String> {
        let device = match self.config.speak.mode {
            SpeakMode::WithMusic => None,
            SpeakMode::Device => Some(self.config.speak.device.clone()),
            SpeakMode::WhereIListen => self.paired_output().map(Some),
        };
        match device {
            None => self.deps.output.speak(clip),
            Some(device) => {
                let (playing, ended) = speaker::play(device, clip)?;
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
        let rms = speech.levels.get(index).copied().unwrap_or(0.0);
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
        match self.route(clip) {
            Ok(ended) => {
                wait(ended, self.inbox.clone(), Msg::Previewed(r#gen));
                self.preview = Some(r#gen);
            }
            Err(error) => self.fail("tts_failed", Some(error)),
        }
    }
}
