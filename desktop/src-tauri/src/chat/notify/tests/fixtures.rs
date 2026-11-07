use std::sync::Arc;

use sc_chat::channel::Channel;
use sc_chat::{
    Clock, ConversationKind, ConversationSummary, DeliveryState, Device, DeviceActions,
    DeviceStatus, MemberRole, MemberState, Message, MessageBody, Millis, NotifyLevel, RichText,
    Seq, Span, SpanKind, SystemEvent, SystemKind, Tier, UserRef,
};
use uuid::Uuid;

pub const ME: &str = "100";
pub const ANN: &str = "200";
pub const NOW: Millis = 1_800_000_000_000;

pub fn chat(kind: ConversationKind) -> ConversationSummary {
    ConversationSummary {
        id: Uuid::from_u128(7),
        kind,
        title: None,
        avatar_url: None,
        avatar_media_id: None,
        peer: Some(UserRef {
            id: ANN.to_owned(),
            name: "Ann".to_owned(),
            avatar_url: None,
            permalink: None,
        }),
        role: MemberRole::Member,
        state: MemberState::Active,
        accepted: true,
        member_count: 2,
        last_seq: 0,
        last_at: NOW,
        last_read_seq: 0,
        unread: 0,
        mentions: 0,
        preview: None,
        muted_until: None,
        notify: NotifyLevel::All,
        pinned_at: None,
        archived: false,
        ttl_s: None,
        room_code: None,
        history_locked: false,
        has_draft: false,
        pinged: false,
        slow_mode_s: 0,
    }
}

pub fn group(title: &str) -> ConversationSummary {
    ConversationSummary {
        title: Some(title.to_owned()),
        peer: None,
        member_count: 5,
        ..chat(ConversationKind::Group)
    }
}

pub fn text(seq: Seq, body: &str) -> Message {
    message(
        seq,
        MessageBody::Text(RichText {
            text: body.to_owned(),
            spans: Vec::new(),
        }),
    )
}

pub fn spoiler(seq: Seq, body: &str, start: u32, len: u32) -> Message {
    message(
        seq,
        MessageBody::Text(RichText {
            text: body.to_owned(),
            spans: vec![Span {
                kind: SpanKind::Spoiler,
                start,
                len,
                url: None,
                user_id: None,
            }],
        }),
    )
}

pub fn system(seq: Seq, kind: SystemKind, target: &str) -> Message {
    let event = SystemEvent {
        kind,
        actor: Some(ANN.to_owned()),
        target: Some(target.to_owned()),
        name: None,
        ttl_s: None,
        until: None,
        track: None,
        role: None,
        on: None,
    };
    message(seq, MessageBody::System(event))
}

pub fn message(seq: Seq, body: MessageBody) -> Message {
    Message {
        conversation_id: Uuid::from_u128(7),
        seq: Some(seq),
        client_id: Uuid::from_u128(seq as u128),
        sender: ANN.to_owned(),
        sender_device: None,
        mine: false,
        ts: NOW,
        edited_at: None,
        expires_at: None,
        state: DeliveryState::Delivered,
        body,
        reply_to: None,
        mentions: Vec::new(),
        mentions_me: false,
        embeds: Vec::new(),
        attachments: Vec::new(),
        forwarded_from: None,
        reactions: Vec::new(),
        pinned: false,
        local_only: false,
    }
}

pub fn device(name: &str, platform: &str) -> Device {
    Device {
        id: Uuid::from_u128(9),
        platform: platform.to_owned(),
        name: name.to_owned(),
        app_version: "8.7.0".to_owned(),
        tier: Tier::Direct,
        status: DeviceStatus::Active,
        created_at: NOW,
        last_seen_at: NOW,
        history_unlocked: false,
        current: false,
        actions: DeviceActions::default(),
    }
}

struct BehindClock;

#[sc_chat::async_trait]
impl Clock for BehindClock {
    fn now_ms(&self) -> Millis {
        1_000
    }

    async fn sleep(&self, _ms: u64) {}
}

pub fn channel_at(server_now: Millis) -> Arc<Channel> {
    let channel = Channel::new(Arc::new(BehindClock));
    channel.note_server_now(server_now);
    Arc::new(channel)
}
