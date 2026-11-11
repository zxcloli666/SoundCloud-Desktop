use sc_chat::api::wire::{MemberView, RequestList};
use sc_chat::store::Store;
use sc_chat::{
    ChatError, ConversationMeta, ConversationPatch, ConversationSummary, HistoryPage, HistoryQuery,
    MemberRole, MemberState, MetaPatch, ReportInput, ReportReason, RichText, Span, SpanKind,
    TEXT_MAX,
};
use serde_json::json;
use uuid::Uuid;

use super::compose::{check_text, mentions};
use super::convert;
use super::gallery::reached;
use super::reads::reaches_back;
use super::safety::checked;

#[test]
fn mentions_come_from_mention_spans_once_each() {
    let span = |kind, user: Option<&str>| Span {
        kind,
        start: 0,
        len: 1,
        url: None,
        user_id: user.map(str::to_string),
    };
    let text = RichText {
        text: "@a @b @a".into(),
        spans: vec![
            span(SpanKind::Mention, Some("1")),
            span(SpanKind::Bold, None),
            span(SpanKind::Mention, Some("2")),
            span(SpanKind::Mention, Some("1")),
        ],
    };
    assert_eq!(mentions(&text), ["1", "2"]);
}

#[test]
fn text_is_capped_in_utf16_units() {
    let long = RichText {
        text: "я".repeat(TEXT_MAX),
        spans: Vec::new(),
    };
    assert!(check_text(&long).is_ok());
    let longer = RichText {
        text: "😀".repeat(TEXT_MAX / 2 + 1),
        spans: Vec::new(),
    };
    assert!(check_text(&longer).is_err());
}

#[test]
fn members_and_requests_parse_from_the_server() {
    let member: MemberView = serde_json::from_value(json!({
        "user_id": "42", "role": "admin", "state": "invited",
        "accepted": false, "joined_seq": 3, "invited_by": "7"
    }))
    .unwrap();
    let member = convert::member(&member, convert::bare("42"));
    assert_eq!(member.role, MemberRole::Admin);
    assert_eq!(member.state, MemberState::Invited);
    assert_eq!(member.invited_by.as_deref(), Some("7"));

    let listed: RequestList = serde_json::from_value(json!({
        "requests": [{
            "conversation_id": "0192e5c5-1a2b-7c3d-8e4f-5a6b7c8d9e0f",
            "kind": "direct", "from": "42", "since": 1, "last_seq": 7,
            "last_at": 2, "member_count": 2, "meta_ct": null, "meta_epoch": null
        }],
        "count": 1
    }))
    .unwrap();
    let request = convert::request(&listed.requests[0], None, convert::bare("42"));
    assert_eq!(request.messages, 3);
    assert!(!request.conversation.accepted);
    assert_eq!(request.conversation.state, MemberState::Invited);
    assert_eq!(request.from.id, "42");
    assert!(convert::pending(&request));

    let unanswered = ConversationSummary {
        state: MemberState::Active,
        ..request.conversation.clone()
    };
    let known = convert::request(&listed.requests[0], Some(unanswered), convert::bare("42"));
    assert!(!convert::pending(&known));
}

#[test]
fn the_gallery_reaches_back_only_while_the_server_gives_older_posts() {
    assert_eq!(reached([40, 12, 30].into_iter(), Some(50)), Some(12));
    assert_eq!(reached([40, 12].into_iter(), None), Some(12));
    assert_eq!(reached([50, 60].into_iter(), Some(50)), None);
    assert_eq!(reached([-3, -1].into_iter(), Some(50)), None);
    assert_eq!(reached(std::iter::empty(), Some(50)), None);
}

#[test]
fn a_report_is_trimmed_and_checked_before_it_leaves() {
    let report = |seq_from, seq_to, comment: Option<&str>| ReportInput {
        conversation_id: Uuid::nil(),
        seq_from,
        seq_to,
        reason: ReportReason::Spam,
        comment: comment.map(str::to_string),
    };
    let kept = checked(report(1, 2, Some("  spam  "))).unwrap();
    assert_eq!(kept.comment.as_deref(), Some("spam"));
    assert_eq!(checked(report(1, 2, Some("   "))).unwrap().comment, None);
    assert_eq!(checked(report(3, 2, None)).err(), Some(ChatError::Invalid));
    let long = "x".repeat(501);
    assert_eq!(
        checked(report(1, 2, Some(&long))).err(),
        Some(ChatError::Invalid)
    );
}

#[test]
fn older_history_is_asked_from_the_server_only_past_the_local_end() {
    let empty = HistoryPage {
        messages: Vec::new(),
        more: false,
    };
    let query = |before, after, limit| HistoryQuery {
        before,
        after,
        limit,
    };
    assert!(reaches_back(&query(Some(100), None, 50), &empty));
    assert!(reaches_back(&query(None, None, 50), &empty));
    assert!(!reaches_back(&query(None, Some(10), 50), &empty));
    assert!(!reaches_back(&query(Some(100), None, 0), &empty));
}

fn stored_group(store: &Store, id: Uuid) {
    let listed: RequestList = serde_json::from_value(json!({
        "requests": [{
            "conversation_id": id, "kind": "group", "from": "42", "since": 1, "last_seq": 0,
            "last_at": 0, "member_count": 3, "meta_ct": null, "meta_epoch": null
        }],
        "count": 1
    }))
    .unwrap();
    let summary = convert::request(&listed.requests[0], None, convert::bare("42")).conversation;
    store.put_conversations(&[summary]).unwrap();
}

#[test]
fn a_rename_keeps_the_description() {
    let store = Store::open_in_memory(&[7; 32]).unwrap();
    let id = Uuid::from_u128(9);
    stored_group(&store, id);
    let meta = ConversationMeta {
        title: "Old".into(),
        description: "About us".into(),
        avatar: None,
        backdrop: None,
    };
    store.put_group_meta(id, &meta).unwrap();
    let patch = ConversationPatch {
        meta: Some(MetaPatch {
            title: Some("New".into()),
            description: None,
        }),
        ..Default::default()
    };
    let next = store.next_meta(id, &patch).unwrap();
    assert_eq!(next.title, "New");
    assert_eq!(next.description, "About us");
}
