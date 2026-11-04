use sc_chat::{
    ConversationKind, ConversationSummary, Device, Embed, EmbedKind, Message, MessageBody,
    PreviewMode, RichText, SpanKind, SystemKind,
};

use super::rules::Reason;
use super::strings::Strings;

const BODY_MAX_CHARS: usize = 180;
const SPOILER: &str = "•••";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Alert {
    pub title: Option<String>,
    pub body: String,
}

pub fn chat(
    chat: &ConversationSummary,
    message: &Message,
    reason: Reason,
    sender: Option<&str>,
    mode: PreviewMode,
    strings: &Strings,
) -> Alert {
    let title = (mode != PreviewMode::Hidden).then(|| chat_title(chat, strings));
    let body = match reason {
        Reason::Personal(kind) => personal(kind, strings).to_owned(),
        Reason::Post | Reason::Mention => message_line(message, sender, mode, strings)
            .unwrap_or_else(|| strings.new_message.clone()),
    };
    Alert { title, body }
}

pub fn device(device: &Device, strings: &Strings) -> Alert {
    let name = [device.name.as_str(), device.platform.as_str()]
        .into_iter()
        .map(one_line)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(", ");
    Alert {
        title: Some(strings.device_title.clone()),
        body: clip(&strings.device_body.replace("{{device}}", &name)),
    }
}

fn chat_title(chat: &ConversationSummary, strings: &Strings) -> String {
    let named = [
        chat.title.as_deref(),
        chat.peer.as_ref().map(|peer| peer.name.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(one_line)
    .find(|name| !name.is_empty());
    if let Some(name) = named {
        return clip(&name);
    }
    match (chat.kind, chat.room_code.as_deref()) {
        (ConversationKind::Room, Some(code)) => format!("{} {code}", strings.room),
        (ConversationKind::Room, None) => strings.room.clone(),
        (ConversationKind::Group, _) => strings.group.clone(),
        (ConversationKind::Direct | ConversationKind::Saved, _) => strings.chat.clone(),
    }
}

fn personal(kind: SystemKind, strings: &Strings) -> &str {
    match kind {
        SystemKind::Kicked => &strings.kicked,
        SystemKind::Removed => &strings.removed,
        SystemKind::Banned => &strings.banned,
        SystemKind::Muted => &strings.muted,
        SystemKind::Handoff => &strings.host,
        _ => &strings.new_message,
    }
}

fn message_line(
    message: &Message,
    sender: Option<&str>,
    mode: PreviewMode,
    strings: &Strings,
) -> Option<String> {
    if mode != PreviewMode::Full || message.expires_at.is_some() {
        return None;
    }
    let MessageBody::Text(text) = &message.body else {
        return None;
    };
    let line = plain(text)
        .or_else(|| {
            message
                .embeds
                .first()
                .map(|embed| embed_line(embed, strings))
        })
        .or_else(|| photos_line(message.attachments.len(), strings))?;
    let line = match sender.map(one_line).filter(|name| !name.is_empty()) {
        Some(name) => format!("{name}: {line}"),
        None => line,
    };
    Some(clip(&line))
}

fn plain(text: &RichText) -> Option<String> {
    let line = one_line(&hide_spoilers(text));
    (!line.is_empty()).then_some(line)
}

fn hide_spoilers(text: &RichText) -> String {
    let hidden = text
        .spans
        .iter()
        .filter(|span| span.kind == SpanKind::Spoiler)
        .map(|span| (span.start, span.start.saturating_add(span.len)))
        .collect::<Vec<_>>();
    let mut shown = String::with_capacity(text.text.len());
    let mut at = 0u32;
    let mut inside = false;
    for ch in text.text.chars() {
        let covered = hidden.iter().any(|&(start, end)| at >= start && at < end);
        match (covered, inside) {
            (true, false) => shown.push_str(SPOILER),
            (true, true) => {}
            (false, _) => shown.push(ch),
        }
        inside = covered;
        at = at.saturating_add(ch.len_utf16() as u32);
    }
    shown
}

fn embed_line(embed: &Embed, strings: &Strings) -> String {
    let template = match embed.kind {
        EmbedKind::Track => &strings.track,
        EmbedKind::Playlist => &strings.playlist,
        EmbedKind::User => &strings.profile,
        EmbedKind::RoomInvite => return strings.room_invite.clone(),
    };
    template.replace("{{title}}", &one_line(&embed.title))
}

fn photos_line(count: usize, strings: &Strings) -> Option<String> {
    match count {
        0 => None,
        1 => Some(strings.photo.clone()),
        _ => Some(strings.photos.replace("{{count}}", &count.to_string())),
    }
}

fn one_line(text: &str) -> String {
    text.split(|ch: char| ch.is_whitespace() || ch.is_control())
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn clip(line: &str) -> String {
    if line.chars().count() <= BODY_MAX_CHARS {
        return line.to_owned();
    }
    let mut clipped = line
        .chars()
        .take(BODY_MAX_CHARS - 1)
        .collect::<String>()
        .trim_end()
        .to_owned();
    clipped.push('…');
    clipped
}
