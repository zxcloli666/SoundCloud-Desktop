mod stream;

#[cfg(test)]
mod tests;

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;
use tokio::sync::oneshot;
use voice_chat::ChatEvent;
use voice_engine::{Chat, Command};

use self::stream::Patience;
use super::Voice;
use crate::app::diagnostics;
use crate::diag::trace;
use crate::network::{edge, fetch};
use crate::rt::AppHandle;

const BASES: [&str; 2] = ["api-star", "api"];
const PATIENCE: Patience = Patience {
    answer: Duration::from_secs(30),
    silence: Duration::from_secs(40),
};

#[derive(Deserialize)]
pub struct Turn {
    id: String,
    speak: bool,
    body: Value,
}

#[derive(Debug, PartialEq, Serialize)]
pub struct Refused {
    pub code: &'static str,
}

#[derive(Default)]
pub struct Rounds {
    running: Mutex<HashMap<String, (u64, oneshot::Sender<()>)>>,
    last: AtomicU64,
}

struct Tally {
    asked: Instant,
    counts: Mutex<Counts>,
}

#[derive(Default)]
struct Counts {
    says: usize,
    chars: usize,
    actions: usize,
    first: Option<Duration>,
    ended: Option<String>,
}

pub async fn round(
    app: &AppHandle,
    voice: &Voice,
    turn: Turn,
    events: &Channel<ChatEvent>,
) -> Result<(), Refused> {
    let (serial, cancelled) = voice.rounds.begin(&turn.id);
    let tell = |step: Chat| {
        let id = turn.id.clone();
        voice.engine.send(Command::Chat { id, step });
    };
    tell(Chat::Open { speak: turn.speak });
    let tally = Tally::start();
    let pass = |event: ChatEvent| {
        tally.note(&event);
        if let Some(step) = spoken(&event) {
            tell(step);
        }
        let _ = events.send(event);
    };
    let asked = ask(app, &turn.body, cancelled, &pass);
    let result = trace::within(trace::new_trace(), asked).await;
    voice.rounds.end(&turn.id, serial);
    tally.log(&result);
    result
}

pub fn cancel(voice: &Voice, id: String) {
    voice.rounds.cancel(&id);
    let step = Chat::Cancel;
    voice.engine.send(Command::Chat { id, step });
}

async fn ask(
    app: &AppHandle,
    body: &Value,
    cancelled: oneshot::Receiver<()>,
    pass: &(dyn Fn(ChatEvent) + Sync),
) -> Result<(), Refused> {
    let token = crate::auth::session_token(Some(app))
        .await
        .ok_or(Refused::SESSION)?;
    let client = fetch::client().ok_or(Refused::NETWORK)?;
    let urls = BASES.map(|base| format!("https://{}/voice/chat", edge::plain_host(base)));
    stream::exchange(client, &urls, &token, body, PATIENCE, cancelled, pass).await
}

fn spoken(event: &ChatEvent) -> Option<Chat> {
    match event {
        ChatEvent::Say { text } => Some(Chat::Text(text.clone())),
        ChatEvent::Done => Some(Chat::Close),
        ChatEvent::Error { .. } => Some(Chat::Cut),
        ChatEvent::Action { .. } | ChatEvent::Cancelled => None,
    }
}

impl Refused {
    pub const SESSION: Refused = Refused { code: "session" };
    pub const NETWORK: Refused = Refused { code: "network" };
}

impl Rounds {
    fn begin(&self, id: &str) -> (u64, oneshot::Receiver<()>) {
        let serial = self.last.fetch_add(1, Ordering::Relaxed) + 1;
        let (stop, stopped) = oneshot::channel();
        let earlier = self.running().insert(id.to_string(), (serial, stop));
        if let Some((_, stop)) = earlier {
            let _ = stop.send(());
        }
        (serial, stopped)
    }

    fn end(&self, id: &str, serial: u64) {
        let mut running = self.running();
        if running.get(id).is_some_and(|(at, _)| *at == serial) {
            running.remove(id);
        }
    }

    pub fn cancel(&self, id: &str) {
        if let Some((_, stop)) = self.running().remove(id) {
            let _ = stop.send(());
        }
    }

    fn running(&self) -> MutexGuard<'_, HashMap<String, (u64, oneshot::Sender<()>)>> {
        self.running
            .lock()
            .unwrap_or_else(|poison| poison.into_inner())
    }
}

impl Tally {
    fn start() -> Tally {
        Tally {
            asked: Instant::now(),
            counts: Mutex::default(),
        }
    }

    fn note(&self, event: &ChatEvent) {
        let mut counts = self
            .counts
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        counts.first.get_or_insert(self.asked.elapsed());
        match event {
            ChatEvent::Say { text } => {
                counts.says += 1;
                counts.chars += text.chars().count();
            }
            ChatEvent::Action { .. } => counts.actions += 1,
            ChatEvent::Done => counts.ended = Some("done".into()),
            ChatEvent::Error { code } => counts.ended = Some(format!("error {code}")),
            ChatEvent::Cancelled => counts.ended = Some("cancelled".into()),
        }
    }

    fn log(&self, result: &Result<(), Refused>) {
        let counts = self
            .counts
            .lock()
            .unwrap_or_else(|poison| poison.into_inner());
        let took = self.asked.elapsed().as_millis();
        let line = match result {
            Err(refused) => format!("[Voice] chat refused {} in {took} ms", refused.code),
            Ok(()) => format!(
                "[Voice] chat {} in {took} ms, first event after {} ms, {} pieces of {} chars, {} actions",
                counts.ended.as_deref().unwrap_or("ended"),
                counts.first.map_or(0, |first| first.as_millis()),
                counts.says,
                counts.chars,
                counts.actions,
            ),
        };
        diagnostics::log("INFO", line);
    }
}
