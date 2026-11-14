use std::collections::VecDeque;
use std::sync::Arc;
use std::sync::mpsc::Receiver;
use std::time::{Duration, Instant};

use voice_audio::OutputInfo;
use voice_audio::routing::same_physical;

use crate::clip::Clip;
use crate::config::{Config, Language, SpeakMode};
use crate::draft::Draft;
use crate::event::{Event, Spoke, State};
use crate::machine::{Core, Msg, Phase};
use crate::pauses::{Mark, Pauses};
use crate::server::Server;
use crate::speech::Speech;
use crate::stream::Stream;
use crate::tts::{Piece, Say, Source};
use crate::{Timing, models, plain, speaker, voices};

const SPEECH_INPUT: &str = "speech";
const GRACE: Duration = Duration::from_secs(3);

pub struct Reply {
    source: Source,
    language: Language,
    speed: f32,
    pitch: f32,
    lines: VecDeque<Line>,
    pauses: Option<Pauses>,
    speech: Option<Speech>,
    broken: bool,
    until: Option<Instant>,
    turn: Option<String>,
    asked: Instant,
    first: Option<Duration>,
    said: (usize, usize),
}

struct Line {
    r#gen: u64,
    draft: Option<Draft>,
    mark: Mark,
}

impl Reply {
    fn new(source: Source, config: &Config) -> Reply {
        Reply {
            source,
            language: config.language,
            speed: config.speak.speed,
            pitch: config.speak.pitch,
            lines: VecDeque::new(),
            pauses: None,
            speech: None,
            broken: false,
            until: None,
            turn: None,
            asked: Instant::now(),
            first: None,
            said: (0, 0),
        }
    }

    fn patience(&self, timing: &Timing) -> Duration {
        match self.source {
            Source::Server { .. } => timing.server,
            _ => timing.synth,
        }
    }

    fn line(&mut self, r#gen: u64, text: String, until: Instant, turn: Option<&str>) -> Say {
        if self.lines.is_empty() {
            self.until = Some(until);
        }
        if let Some(turn) = turn {
            self.turn = Some(turn.to_string());
        }
        let mark = Mark::of(&text);
        self.said.0 += 1;
        self.said.1 += text.chars().count();
        let text = match self.source {
            Source::Qwen { .. } | Source::Server { .. } => plain::text(&text, self.language),
            _ => text,
        };
        self.lines.push_back(Line {
            r#gen,
            draft: Some(Draft::new(&text)),
            mark,
        });
        Say {
            r#gen,
            text,
            language: self.language,
            source: self.source.clone(),
            speed: self.speed,
            pitch: self.pitch,
            kept: turn.is_none(),
        }
    }

    fn take(&mut self, rate: u32, samples: Vec<f32>, now: Instant) -> bool {
        let Some(line) = self.lines.front_mut() else {
            return false;
        };
        let queued = self.speech.as_ref().map_or(0.0, |speech| speech.lead(now));
        let drafted = line.draft.as_ref().map_or(0.0, Draft::seconds);
        let pauses = self.pauses.get_or_insert_with(|| Pauses::new(rate));
        let samples = pauses.push(samples, queued + drafted);
        if samples.is_empty() {
            return false;
        }
        let Some(draft) = line.draft.as_mut() else {
            if let Some(speech) = self.speech.as_mut() {
                speech.take(samples, now);
            }
            return false;
        };
        draft.take(rate, samples, now);
        let lead = self.speech.as_ref().map_or(0.0, |speech| speech.lead(now));
        draft.ready(now, lead)
    }

    fn draft(&mut self) -> Option<Draft> {
        let draft = self.lines.front_mut()?.draft.take()?;
        Some(draft).filter(|draft| !draft.samples.is_empty())
    }

    fn ended(&mut self) {
        let line = self.lines.pop_front();
        if let (Some(line), Some(pauses)) = (line, self.pauses.as_mut()) {
            pauses.line_ended(line.mark);
        }
    }

    fn last_sound(&mut self) -> Vec<f32> {
        self.pauses.as_mut().map(Pauses::finish).unwrap_or_default()
    }

    fn spoke(&self) -> Option<Spoke> {
        let speech = self.speech.as_ref()?;
        let (waited, gaps) = speech.waited();
        Some(Spoke {
            lines: self.said.0,
            chars: self.said.1,
            first: self.first?,
            voiced: speech.voiced(),
            waited,
            gaps,
        })
    }

    fn busy(&self, now: Instant) -> bool {
        !self.lines.is_empty() || self.speech.as_ref().is_some_and(|s| s.dry() > now)
    }

    fn deadline(&self) -> Option<Instant> {
        let tick = self.speech.as_ref().and_then(Speech::tick);
        [self.until, tick].into_iter().flatten().min()
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
    pub fn say(&mut self, text: String) -> bool {
        self.line(text, None)
    }

    pub fn say_in(&mut self, turn: &str, text: String) -> bool {
        self.line(text, Some(turn))
    }

    fn line(&mut self, text: String, turn: Option<&str>) -> bool {
        let fresh = self.reply.is_none();
        if fresh {
            let Some(source) = self.voice() else {
                return false;
            };
            self.reply = Some(Reply::new(source, &self.config));
        }
        let r#gen = self.next_gen();
        let timing = self.deps.timing;
        let Some(reply) = self.reply.as_mut().filter(|reply| !reply.broken) else {
            return false;
        };
        let until = Instant::now() + reply.patience(&timing);
        let say = reply.line(r#gen, text, until, turn);
        if fresh {
            self.tts.say(say);
        } else {
            self.tts.then(say);
        }
        true
    }

    fn voice(&self) -> Option<Source> {
        let voice = voices::find(&self.config.speak.voice);
        let local = self.local_voice(voice);
        match self.server(voice) {
            Some(server) => models::server(voice, server, local),
            None => local,
        }
    }

    fn local_voice(&self, voice: &voices::Voice) -> Option<Source> {
        if let Some(given) = &self.deps.voice {
            return Some(Source::Given(given.clone()));
        }
        models::source(&self.deps.store, voice)
    }

    fn server(&self, voice: &voices::Voice) -> Option<Arc<dyn Server>> {
        let server = self.deps.server.clone()?;
        models::on_server(&self.config, voice).then_some(server)
    }

    pub fn warm_voice(&self) {
        if !self.config.speak.replies {
            return;
        }
        let voice = voices::find(&self.config.speak.voice);
        if let voices::Kind::Qwen { speaker, .. } = voice.kind
            && self.server(voice).is_none()
            && let Some(paths) = models::qwen(&self.deps.store, voice)
        {
            self.tts.warm(paths, speaker);
        }
    }

    pub fn synthesized(&mut self, r#gen: u64, piece: Piece) {
        if let Piece::Trouble(trouble) = piece {
            return self.emit(Event::Trouble(trouble));
        }
        let now = Instant::now();
        let timing = self.deps.timing;
        let Some(reply) = self.reply.as_mut() else {
            return;
        };
        let until = now + reply.patience(&timing);
        if reply.lines.front().map(|line| line.r#gen) != Some(r#gen) {
            return;
        }
        match piece {
            Piece::Audio { rate, samples } => {
                reply.until = Some(until);
                if reply.take(rate, samples, now) {
                    self.play_line(now);
                }
            }
            Piece::End => {
                self.play_line(now);
                if let Some(reply) = self.reply.as_mut() {
                    reply.ended();
                    reply.until = Some(until).filter(|_| !reply.lines.is_empty());
                }
                self.rest(now);
            }
            Piece::Failed(error) => self.mute(error, now),
            Piece::Again => reply.until = Some(until),
            Piece::Trouble(_) => {}
        }
    }

    fn play_line(&mut self, now: Instant) {
        let Some(draft) = self.reply.as_mut().and_then(Reply::draft) else {
            return;
        };
        let silent = self.reply.as_ref().is_some_and(|r| r.speech.is_none());
        if silent && let Err(error) = self.open_speech(draft.rate, now) {
            return self.mute(error, now);
        }
        if let Some(speech) = self.reply.as_mut().and_then(|r| r.speech.as_mut()) {
            let waited = speech.starved(now);
            speech.take(draft.after(waited), now);
        }
    }

    fn open_speech(&mut self, rate: u32, now: Instant) -> Result<(), String> {
        let (feed, stream) = Stream::open(rate);
        let r#gen = self.next_gen();
        let ended = self.route(stream)?;
        wait(ended, self.inbox.clone(), Msg::Spoken(r#gen));
        self.deps.output.duck(self.config.duck);
        if let Some(reply) = self.reply.as_mut() {
            reply.speech = Some(Speech::new(r#gen, rate, feed, now));
            reply.first = Some(now.saturating_duration_since(reply.asked));
        }
        self.emit_state(State::Speaking, None);
        Ok(())
    }

    fn mute(&mut self, error: String, now: Instant) {
        self.fail("tts_failed", Some(error));
        self.tts.forget();
        if let Some(reply) = self.reply.as_mut() {
            reply.lines.clear();
            reply.broken = true;
            reply.until = None;
        }
        self.rest(now);
    }

    pub fn rest(&mut self, now: Instant) {
        if self.running() {
            return;
        }
        let Some(reply) = self.reply.as_mut().filter(|r| r.lines.is_empty()) else {
            return;
        };
        let last = reply.last_sound();
        match reply.speech.as_mut() {
            Some(speech) if speech.open() => {
                if !last.is_empty() {
                    speech.take(last, now);
                }
                speech.close();
                reply.until = Some(speech.dry().max(now) + GRACE);
            }
            Some(_) => {}
            None => {
                self.reply = None;
                self.unspoken();
            }
        }
    }

    pub fn settle(&mut self) {
        if self.reply.is_none() {
            return self.go_idle();
        }
        self.phase = Phase::Speaking;
        self.rest(Instant::now());
    }

    fn unspoken(&mut self) {
        if matches!(self.phase, Phase::Speaking) {
            self.go_idle();
        }
    }

    pub fn audible(&self) -> bool {
        self.reply.as_ref().is_some_and(|r| r.speech.is_some())
    }

    pub fn speaking(&self, now: Instant) -> bool {
        self.reply.as_ref().is_some_and(|reply| reply.busy(now))
    }

    pub fn speech_deadline(&self) -> Option<Instant> {
        self.reply.as_ref().and_then(Reply::deadline)
    }

    pub fn hush(&mut self) {
        self.deps.output.hush();
        if let Some(playing) = self.playing.take() {
            playing.stop();
        }
        self.preview = None;
        if self.reply.take().is_some() {
            self.tts.forget();
        }
    }

    pub fn hush_turn(&mut self, turn: &str) {
        let spoken = |reply: &Reply| reply.turn.as_deref() == Some(turn);
        if self.reply.as_ref().is_some_and(spoken) {
            self.end_reply();
        }
    }

    fn end_reply(&mut self) {
        let spoke = self.audible();
        self.drop_reply();
        if matches!(self.phase, Phase::Speaking) {
            self.go_idle();
        } else if spoke {
            self.emit_state(self.state(), None);
        }
    }

    pub fn drop_reply(&mut self) {
        if self.audible() {
            self.hush();
        }
        if self.reply.take().is_some() {
            self.tts.forget();
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
        let speech = self.reply.as_ref().and_then(|r| r.speech.as_ref());
        if speech.is_none_or(|speech| speech.r#gen != r#gen) {
            return;
        }
        self.playing = None;
        self.level(SPEECH_INPUT.into(), 0.0);
        let reply = self.reply.take();
        if reply.as_ref().is_some_and(|r| !r.lines.is_empty()) {
            self.tts.forget();
        }
        if let Some(spoke) = reply.as_ref().and_then(Reply::spoke) {
            self.emit(Event::Spoke(spoke));
        }
        if matches!(self.phase, Phase::Speaking) {
            self.go_idle();
        } else {
            self.emit_state(self.state(), None);
        }
    }

    pub fn speech_tick(&mut self, now: Instant) {
        let Some(reply) = self.reply.as_mut() else {
            return;
        };
        if reply.until.is_some_and(|until| now >= until) {
            return self.end_reply();
        }
        let level = reply.speech.as_mut().and_then(|speech| speech.level(now));
        if let Some(rms) = level {
            self.level(SPEECH_INPUT.into(), rms);
        }
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
    use std::path::PathBuf;
    use std::sync::{Arc, Mutex};

    use voice_qwen::{Paths, Sink};

    use super::*;
    use crate::server::{Ask, Said};
    use crate::tts::Voice;

    const WRITTEN: &str = "Громкость 50%, включаю что-нибудь…";
    const PLAIN: &str = "Громкость пятьдесят процентов, включаю что нибудь.";

    struct Mute;

    impl Voice for Mute {
        fn rate(&self) -> u32 {
            24000
        }

        fn say(&mut self, _: &str, _: &mut dyn Sink) -> Result<(), String> {
            Ok(())
        }
    }

    struct Down;

    impl Server for Down {
        fn say(&self, _: &Ask, _: &dyn Fn() -> bool) -> Result<Said, String> {
            Err("down".into())
        }
    }

    fn kokoro() -> Source {
        Source::Kokoro {
            dir: "voices".into(),
            file: "model.onnx",
            speaker: 0,
        }
    }

    fn qwen() -> Source {
        Source::Qwen {
            paths: Paths {
                program: PathBuf::from("scd-qwen"),
                talker: PathBuf::from("talker.gguf"),
                codec: PathBuf::from("codec.gguf"),
            },
            speaker: "loli",
            cached_as: "loli".into(),
        }
    }

    fn server() -> Source {
        Source::Server {
            voice: "loli",
            server: Arc::new(Down),
            local: None,
        }
    }

    fn line(source: Source) -> Say {
        let mut reply = Reply::new(source, &Config::default());
        reply.line(1, WRITTEN.into(), Instant::now(), None)
    }

    #[test]
    fn a_qwen_voice_gets_the_text_in_plain_words() {
        assert_eq!(line(qwen()).text, PLAIN);
    }

    #[test]
    fn the_server_voice_gets_the_text_in_plain_words_like_the_local_one() {
        assert_eq!(line(server()).text, PLAIN);
    }

    #[test]
    fn a_kokoro_voice_and_a_given_one_get_the_text_as_written() {
        let given = Source::Given(Arc::new(Mutex::new(Mute)));
        assert_eq!(line(kokoro()).text, WRITTEN);
        assert_eq!(line(given).text, WRITTEN);
    }

    #[test]
    fn only_lines_outside_a_chat_turn_are_kept_for_next_time() {
        let mut reply = Reply::new(kokoro(), &Config::default());
        let until = Instant::now();
        assert!(reply.line(1, "Включаю.".into(), until, None).kept);
        assert!(!reply.line(2, "Привет!".into(), until, Some("turn")).kept);
        assert_eq!(reply.turn.as_deref(), Some("turn"));
    }
}
