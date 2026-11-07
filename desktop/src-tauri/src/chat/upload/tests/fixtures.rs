use sc_chat::{
    ConvId, ConversationKind, ConversationSummary, MemberRole, MemberState, NotifyLevel,
};

pub const ROOM_CODE: &str = "dusk-room";

pub fn summary(id: ConvId, kind: ConversationKind) -> ConversationSummary {
    ConversationSummary {
        id,
        kind,
        title: Some("Group".into()),
        avatar_url: None,
        avatar_media_id: None,
        peer: None,
        role: MemberRole::Admin,
        state: MemberState::Active,
        accepted: true,
        member_count: 3,
        last_seq: 0,
        last_at: 0,
        last_read_seq: 0,
        unread: 0,
        mentions: 0,
        preview: None,
        muted_until: None,
        notify: NotifyLevel::All,
        pinned_at: None,
        archived: false,
        ttl_s: None,
        room_code: (kind == ConversationKind::Room).then(|| ROOM_CODE.into()),
        history_locked: false,
        has_draft: false,
        pinged: false,
        slow_mode_s: 0,
    }
}
