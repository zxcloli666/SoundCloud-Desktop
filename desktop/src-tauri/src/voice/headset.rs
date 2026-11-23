use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};
use voice_engine::{Command, Learned, Learner, Signal, Source, WINDOW};

use super::Voice;
use crate::rt::AppHandle;

const LEARNED_EVENT: &str = "voice:headset-learned";
const SETTLE_SLACK: Duration = Duration::from_millis(60);

pub fn headset_presses(app: &AppHandle) -> u8 {
    let Some(voice) = app.try_state::<Voice>() else {
        return 0;
    };
    if !voice.active() {
        return 0;
    }
    voice.config.lock().unwrap().activation.headset.presses()
}

pub fn headset_calls(app: &AppHandle, signal: Signal) -> bool {
    let Some(voice) = app.try_state::<Voice>() else {
        return false;
    };
    voice.active()
        && voice
            .config
            .lock()
            .unwrap()
            .activation
            .headset
            .calls_on(signal)
}

pub fn headset_gesture(app: &AppHandle) {
    if let Some(voice) = app.try_state::<Voice>() {
        voice.engine.send(Command::Start(Source::Headset));
    }
}

pub fn headset_learn(app: &AppHandle, on: bool) {
    if let Some(voice) = app.try_state::<Voice>() {
        *voice.learning.lock().unwrap() = on.then(|| Learner::new(Instant::now()));
    }
}

pub fn headset_signal(app: &AppHandle, signal: Signal) -> bool {
    let Some(voice) = app.try_state::<Voice>() else {
        return false;
    };
    let now = Instant::now();
    let mut learning = voice.learning.lock().unwrap();
    let Some(learner) = learning.as_mut().filter(|learner| learner.live(now)) else {
        *learning = None;
        return false;
    };
    match learner.push(signal, now) {
        Some(learned) => {
            *learning = None;
            told(app, learned);
        }
        None => {
            let app = app.clone();
            voice.rt.spawn(async move {
                tokio::time::sleep(WINDOW + SETTLE_SLACK).await;
                settle(&app);
            });
        }
    }
    true
}

fn settle(app: &AppHandle) {
    let Some(voice) = app.try_state::<Voice>() else {
        return;
    };
    let mut learning = voice.learning.lock().unwrap();
    let Some(learned) = learning
        .as_mut()
        .and_then(|learner| learner.settle(Instant::now()))
    else {
        return;
    };
    if matches!(learned, Learned::Bound(_)) {
        *learning = None;
    }
    told(app, learned);
}

fn told(app: &AppHandle, learned: Learned) {
    app.emit(LEARNED_EVENT, learned.name()).ok();
}
