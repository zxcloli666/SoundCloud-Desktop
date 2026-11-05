use sc_chat::{
    ConversationKind, ConversationSummary, MemberState, Message, MessageBody, Millis, NotifyLevel,
    NotifyPrefs, PreviewMode, SystemEvent, SystemKind,
};

const MUTED_FOREVER_AFTER_MS: Millis = 365 * 24 * 3_600_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reason {
    Post,
    Mention,
    Personal(SystemKind),
}

impl Reason {
    pub fn personal(self) -> bool {
        matches!(self, Reason::Personal(_))
    }
}

pub fn reason(message: &Message, me: &str) -> Option<Reason> {
    if message.mine || message.local_only {
        return None;
    }
    match &message.body {
        MessageBody::System(event) => about_me(event, me).map(Reason::Personal),
        MessageBody::Deleted => None,
        _ if message.mentions_me => Some(Reason::Mention),
        _ => Some(Reason::Post),
    }
}

pub fn allowed(reason: Reason, chat: &ConversationSummary, now: Millis) -> bool {
    match reason {
        Reason::Personal(_) => true,
        _ if silenced(chat, now) => false,
        Reason::Mention => true,
        Reason::Post => !quiet(chat, now),
    }
}

pub fn expired(message: &Message, now: Millis) -> bool {
    message.expires_at.is_some_and(|at| at <= now)
}

pub fn preview(prefs: &NotifyPrefs, streaming: bool) -> PreviewMode {
    match prefs.preview {
        PreviewMode::Full if streaming => PreviewMode::NameOnly,
        mode => mode,
    }
}

fn about_me(event: &SystemEvent, me: &str) -> Option<SystemKind> {
    let personal = matches!(
        event.kind,
        SystemKind::Kicked
            | SystemKind::Removed
            | SystemKind::Banned
            | SystemKind::Muted
            | SystemKind::Handoff
    );
    (personal && event.target.as_deref() == Some(me)).then_some(event.kind)
}

fn silenced(chat: &ConversationSummary, now: Millis) -> bool {
    chat.kind == ConversationKind::Saved
        || chat.state != MemberState::Active
        || request(chat)
        || chat.notify == NotifyLevel::None
        || chat
            .muted_until
            .is_some_and(|until| until.saturating_sub(now) > MUTED_FOREVER_AFTER_MS)
}

fn quiet(chat: &ConversationSummary, now: Millis) -> bool {
    chat.kind == ConversationKind::Room
        || chat.notify == NotifyLevel::Mentions
        || chat.muted_until.is_some_and(|until| until > now)
}

fn request(chat: &ConversationSummary) -> bool {
    matches!(
        chat.kind,
        ConversationKind::Direct | ConversationKind::Group
    ) && !chat.accepted
}
