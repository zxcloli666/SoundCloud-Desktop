mod alert;
mod history;
#[cfg(any(target_os = "linux", test))]
mod markup;
mod prefs_file;
mod rules;
mod screen;
mod settings;
mod show;
mod strings;
#[cfg(test)]
mod tests;

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, Mutex, Once, RwLock};

use sc_chat::channel::Channel;
use sc_chat::store::Store;
use sc_chat::{
    ConversationKind, ConversationSummary, Device, DeviceAddedEvent, DeviceStatus, Message,
    MessagesEvent, MessagesOrigin, Millis, NotifyPrefs, UserId,
};
use tauri::Manager;

use self::history::History;
use self::rules::Reason;
use super::events;
use super::state::ChatState;
use crate::rt::AppHandle;

struct Source {
    store: Arc<Store>,
    me: UserId,
    channel: Arc<Channel>,
}

pub struct Notifier {
    prefs: RwLock<NotifyPrefs>,
    restored: Once,
    source: RwLock<Option<Arc<Source>>>,
    history: Mutex<History>,
    since: AtomicI64,
    watching: AtomicBool,
}

impl Default for Notifier {
    fn default() -> Self {
        Self {
            prefs: RwLock::default(),
            restored: Once::new(),
            source: RwLock::default(),
            history: Mutex::default(),
            since: AtomicI64::new(now_ms()),
            watching: AtomicBool::new(false),
        }
    }
}

impl Notifier {
    pub fn prefs(&self, update: Option<NotifyPrefs>) -> NotifyPrefs {
        self.restored.call_once(|| self.restore());
        if let Some(update) = update {
            self.store_prefs(update);
        }
        self.prefs.read().map(|prefs| *prefs).unwrap_or_default()
    }

    fn store_prefs(&self, update: NotifyPrefs) {
        if let Ok(mut prefs) = self.prefs.write() {
            *prefs = update;
        }
        if let Some(path) = prefs_file::path() {
            prefs_file::write(&path, &update);
        }
    }

    fn restore(&self) {
        let saved = prefs_file::path().and_then(|path| prefs_file::read(&path));
        if let (Some(saved), Ok(mut prefs)) = (saved, self.prefs.write()) {
            *prefs = saved;
        }
    }

    pub fn attach(&self, store: Arc<Store>, me: UserId, channel: Arc<Channel>) {
        let Ok(mut source) = self.source.write() else {
            return;
        };
        let same_user = source.as_ref().is_some_and(|current| current.me == me);
        if !same_user {
            self.since.store(channel.now_ms(), Ordering::Release);
        }
        *source = Some(Arc::new(Source { store, me, channel }));
    }

    pub fn detach(&self) {
        if let Ok(mut source) = self.source.write() {
            *source = None;
        }
        if let Ok(mut history) = self.history.lock() {
            *history = History::default();
        }
    }

    fn source(&self) -> Option<Arc<Source>> {
        self.source.read().ok().and_then(|source| source.clone())
    }

    fn messages(&self, app: &AppHandle, event: &MessagesEvent, blocked: &HashSet<UserId>) {
        let prefs = self.prefs(None);
        let Some(source) = self.source() else {
            return;
        };
        let Ok(Some(chat)) = source.store.conversation(event.conversation_id) else {
            return;
        };
        let server_now = source.channel.now_ms();
        let fresh = self.fresh(&chat, &event.messages, &source.me, blocked, server_now);
        let Some(&(message, reason)) = pick(&fresh) else {
            return;
        };
        let now = now_ms();
        if !prefs.enabled || screen::app_focused(app) || self.throttled(&chat, reason, now) {
            return;
        }
        let settings = settings::read(app);
        let streaming = prefs.stream_mode && (settings.obs_enabled || screen::fullscreen(app));
        let mode = rules::preview(&prefs, streaming);
        let sender = sender_name(&source.store, &chat, message);
        let strings = strings::get(&settings.language);
        let alert = alert::chat(&chat, message, reason, sender.as_deref(), mode, strings);
        show::show(app, alert, prefs.sound);
        if let Ok(mut history) = self.history.lock() {
            history.shown(chat.id, now);
        }
        self.watch_focus(app);
    }

    fn fresh<'a>(
        &self,
        chat: &ConversationSummary,
        messages: &'a [Message],
        me: &str,
        blocked: &HashSet<UserId>,
        now: Millis,
    ) -> Vec<(&'a Message, Reason)> {
        let Ok(seen) = self
            .history
            .lock()
            .map(|mut history| history.see(chat.id, messages))
        else {
            return Vec::new();
        };
        let after = seen.max(chat.last_read_seq);
        let since = self.since.load(Ordering::Acquire);
        messages
            .iter()
            .filter(|message| message.seq.is_some_and(|seq| seq > after))
            .filter(|message| message.ts >= since && !rules::expired(message, now))
            .filter_map(|message| rules::reason(message, me).map(|reason| (message, reason)))
            .filter(|(message, reason)| reason.personal() || !blocked.contains(&message.sender))
            .filter(|(_, reason)| rules::allowed(*reason, chat, now))
            .collect()
    }

    fn throttled(&self, chat: &ConversationSummary, reason: Reason, now: Millis) -> bool {
        !reason.personal()
            && self
                .history
                .lock()
                .map(|history| history.recently_shown(chat.id, now))
                .unwrap_or(true)
    }

    fn device(&self, app: &AppHandle, device: &Device) {
        if device.current || device.status != DeviceStatus::Active {
            return;
        }
        let first = self
            .history
            .lock()
            .map(|mut history| history.first_alert(device.id))
            .unwrap_or(false);
        if !first {
            return;
        }
        let settings = settings::read(app);
        let alert = alert::device(device, strings::get(&settings.language));
        show::show(app, alert, self.prefs(None).sound);
        if let Ok(mut history) = self.history.lock() {
            history.forget_open();
        }
    }

    fn watch_focus(&self, app: &AppHandle) {
        if self.watching.load(Ordering::Acquire) {
            return;
        }
        if screen::on_focus(app, open_notified) {
            self.watching.store(true, Ordering::Release);
        }
    }
}

pub fn on_messages(app: &AppHandle, event: &MessagesEvent) {
    if event.origin != MessagesOrigin::Sync {
        return;
    }
    if let Some(state) = app.try_state::<ChatState>() {
        state
            .notifier
            .messages(app, event, &state.runtime.blocked());
    }
}

pub fn on_device_added(app: &AppHandle, event: &DeviceAddedEvent) {
    if let Some(state) = app.try_state::<ChatState>() {
        state.notifier.device(app, &event.device);
    }
}

fn open_notified(app: &AppHandle) {
    let Some(state) = app.try_state::<ChatState>() else {
        return;
    };
    let opened = state
        .notifier
        .history
        .lock()
        .ok()
        .and_then(|mut history| history.take_open(now_ms()));
    if let Some(conversation_id) = opened {
        events::emit_notify_open(app, conversation_id);
    }
}

fn pick<'a>(fresh: &'a [(&'a Message, Reason)]) -> Option<&'a (&'a Message, Reason)> {
    fresh
        .iter()
        .rev()
        .find(|(_, reason)| reason.personal())
        .or_else(|| fresh.last())
}

fn sender_name(store: &Store, chat: &ConversationSummary, message: &Message) -> Option<String> {
    if !matches!(chat.kind, ConversationKind::Group | ConversationKind::Room) {
        return None;
    }
    let users = store.users(std::slice::from_ref(&message.sender)).ok()?;
    users.into_iter().next().map(|user| user.name)
}

fn now_ms() -> Millis {
    chrono::Utc::now().timestamp_millis()
}
