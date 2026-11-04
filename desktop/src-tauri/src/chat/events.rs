use sc_chat::{ConvId, CoreEvent, Events};
use serde::Serialize;
use tauri::Emitter;

use super::{badge, notify};
use crate::rt::AppHandle;

pub const STATUS: &str = "chat:status";
pub const SYNC: &str = "chat:sync";
pub const MESSAGES: &str = "chat:messages";
pub const TYPING: &str = "chat:typing";
pub const GONE: &str = "chat:gone";
pub const DEVICE_ADDED: &str = "chat:device-added";
pub const MEDIA_UPLOADS: &str = "chat:media-uploads";
pub const NOTIFY_OPEN: &str = "chat:notify-open";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotifyOpen {
    pub conversation_id: ConvId,
}

pub struct TauriEvents {
    app: AppHandle,
}

impl TauriEvents {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

impl Events for TauriEvents {
    fn emit(&self, event: CoreEvent) {
        match &event {
            CoreEvent::Status(status) => badge::apply(&self.app, status),
            CoreEvent::Messages(messages) => notify::on_messages(&self.app, messages),
            CoreEvent::DeviceAdded(added) => notify::on_device_added(&self.app, added),
            CoreEvent::Sync(_)
            | CoreEvent::Typing(_)
            | CoreEvent::Gone(_)
            | CoreEvent::MediaUploads(_) => {}
        }
        emit(&self.app, &event);
    }
}

pub fn emit(app: &AppHandle, event: &CoreEvent) {
    let _ = match event {
        CoreEvent::Status(payload) => app.emit(STATUS, payload),
        CoreEvent::Sync(payload) => app.emit(SYNC, payload),
        CoreEvent::Messages(payload) => app.emit(MESSAGES, payload),
        CoreEvent::Typing(payload) => app.emit(TYPING, payload),
        CoreEvent::Gone(payload) => app.emit(GONE, payload),
        CoreEvent::DeviceAdded(payload) => app.emit(DEVICE_ADDED, payload),
        CoreEvent::MediaUploads(payload) => app.emit(MEDIA_UPLOADS, payload),
    };
}

pub fn emit_notify_open(app: &AppHandle, conversation_id: ConvId) {
    let _ = app.emit(NOTIFY_OPEN, NotifyOpen { conversation_id });
}
