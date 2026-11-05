use sc_chat::api::wire::{MemberView, RequestView};
use sc_chat::store::Store;
use sc_chat::{
    ChatRequest, ConversationSummary, Member, MemberRole, MemberState, NotifyLevel, UserId, UserRef,
};

const REQUEST_MESSAGES_MAX: i64 = 3;

pub fn request(
    view: &RequestView,
    stored: Option<ConversationSummary>,
    from: UserRef,
) -> ChatRequest {
    let conversation = stored.unwrap_or_else(|| ConversationSummary {
        id: view.conversation_id,
        kind: view.kind,
        title: None,
        avatar_url: from.avatar_url.clone(),
        avatar_media_id: None,
        peer: Some(from.clone()),
        role: MemberRole::Member,
        state: MemberState::Invited,
        accepted: false,
        member_count: count(view.member_count),
        last_seq: view.last_seq,
        last_at: view.last_at,
        last_read_seq: 0,
        unread: count(view.last_seq),
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
    });
    ChatRequest {
        conversation,
        from,
        messages: count(view.last_seq.clamp(0, REQUEST_MESSAGES_MAX)),
    }
}

pub fn member(view: &MemberView, user: UserRef) -> Member {
    Member {
        user,
        role: role(&view.role),
        state: member_state(&view.state),
        accepted: view.accepted,
        joined_seq: view.joined_seq,
        invited_by: view.invited_by.clone(),
    }
}

pub fn people(store: &Store, ids: &[UserId]) -> Vec<UserRef> {
    let known = store.users(ids).unwrap_or_default();
    ids.iter()
        .map(|id| {
            known
                .iter()
                .find(|user| &user.id == id)
                .cloned()
                .unwrap_or_else(|| bare(id))
        })
        .collect()
}

pub fn bare(id: &str) -> UserRef {
    UserRef {
        id: id.to_string(),
        name: id.to_string(),
        avatar_url: None,
        permalink: None,
    }
}

fn role(raw: &str) -> MemberRole {
    match raw {
        "owner" => MemberRole::Owner,
        "admin" => MemberRole::Admin,
        _ => MemberRole::Member,
    }
}

fn member_state(raw: &str) -> MemberState {
    match raw {
        "invited" => MemberState::Invited,
        "left" => MemberState::Left,
        "kicked" => MemberState::Kicked,
        "banned" => MemberState::Banned,
        _ => MemberState::Active,
    }
}

fn count(value: impl TryInto<u32>) -> u32 {
    value.try_into().unwrap_or(0)
}
