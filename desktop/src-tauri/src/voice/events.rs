use std::sync::mpsc::Receiver;

use tauri::{Emitter, Manager};
use voice_engine::Event;

use super::{MAIN, Voice};
use crate::rt::AppHandle;

pub fn forward(app: AppHandle, events: Receiver<Event>) {
    let spawned = std::thread::Builder::new()
        .name("voice-events".into())
        .spawn(move || {
            for event in events {
                if let Some(voice) = app.try_state::<Voice>() {
                    voice.note(&event);
                }
                let name = event.name();
                let _ = match event {
                    Event::State(payload) => app.emit_to(MAIN, name, payload),
                    Event::Level(payload) => app.emit_to(MAIN, name, payload),
                    Event::Partial(payload) => app.emit_to(MAIN, name, payload),
                    Event::Command(payload) => app.emit_to(MAIN, name, payload),
                    Event::Error(payload) => app.emit_to(MAIN, name, payload),
                    Event::Cancelled(_) => Ok(()),
                };
            }
        });
    if let Err(error) = spawned {
        crate::app::diagnostics::error(format!("[Voice] events thread: {error}"));
    }
}
