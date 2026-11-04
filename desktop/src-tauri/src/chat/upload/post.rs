use std::sync::Arc;

use sc_chat::envelope::{self, Content, Post};
use sc_chat::outbox::{Outbox, OutboxItem};
use sc_chat::sc_chat_wire::prost::Message as _;
use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::store::{MediaUpload, NewUpload, Store};
use sc_chat::{
    ChatError, ChatResult, ConvId, DeliveryState, MediaKind, Message, MessageBody, MessageClass,
    Millis, UploadState,
};
use uuid::Uuid;

pub const PARKED_AT: Millis = Millis::MAX / 2;
const ATTACH_LAPSE_MS: Millis = 50 * 60 * 1000;

pub enum Posted {
    None,
    Parked(Message),
    Stale(Message),
    Sending(Message),
}

pub enum Released {
    Waiting,
    Pushed,
    Freed(Vec<MediaUpload>),
    Renewed(Vec<Uuid>),
}

pub fn posted(
    store: &Arc<Store>,
    conversation_id: ConvId,
    album: Uuid,
    uploads: &[MediaUpload],
) -> ChatResult<Posted> {
    Ok(posted_from(
        pending_post(store, conversation_id, album)?,
        uploads,
    ))
}

pub fn posted_from(message: Option<Message>, uploads: &[MediaUpload]) -> Posted {
    let Some(message) = message else {
        return Posted::None;
    };
    let shown = |id: Uuid| message.attachments.iter().any(|seen| seen.media_id == id);
    if uploads.iter().any(|upload| shown(upload.id)) {
        return Posted::Parked(message);
    }
    let current = uploads
        .iter()
        .all(|upload| upload.media_id.is_some_and(shown));
    match current && message.attachments.len() == uploads.len() {
        true => Posted::Sending(message),
        false => Posted::Stale(message),
    }
}

pub fn settles(posted: &Posted, uploads: &[MediaUpload], now: Millis) -> bool {
    match posted {
        Posted::Sending(message) => {
            message.state == DeliveryState::Failed
                && uploads.iter().any(|upload| lapsed(upload, now))
        }
        _ => true,
    }
}

pub fn release_in(store: &Arc<Store>, album: Uuid, now: Millis) -> ChatResult<Released> {
    let uploads = store.album_uploads(album)?;
    let Some(first) = uploads.first() else {
        return Ok(Released::Waiting);
    };
    if first.kind != MediaKind::Image || !ready(&uploads) {
        return Ok(Released::Waiting);
    }
    let conversation_id = first.conversation_id;
    let post = posted(store, conversation_id, album, &uploads)?;
    if !settles(&post, &uploads, now) {
        return Ok(Released::Waiting);
    }
    match post {
        Posted::None => Ok(Released::Freed(store.remove_album_uploads(album)?)),
        Posted::Parked(message) | Posted::Stale(message) => {
            push(
                store,
                conversation_id,
                album,
                post_of(message)?,
                &uploads,
                now,
            )?;
            Ok(Released::Pushed)
        }
        Posted::Sending(message) => renew_in(store, album, conversation_id, message, &uploads, now),
    }
}

pub fn repark_in(
    store: &Arc<Store>,
    album: Uuid,
    conversation_id: ConvId,
    parked: Message,
    now: Millis,
) -> ChatResult<Released> {
    let uploads = store.album_uploads(album)?;
    if !uploads.is_empty() && ready(&uploads) {
        return release_in(store, album, now);
    }
    let post = post_of(parked)?;
    if !uploads.is_empty() {
        push(store, conversation_id, album, post, &uploads, now)?;
        return Ok(Released::Waiting);
    }
    if post.text.text.trim().is_empty() && post.embeds.is_empty() {
        Outbox::new(store.clone()).discard(album)?;
        return Ok(Released::Waiting);
    }
    push(store, conversation_id, album, post, &[], now)?;
    Ok(Released::Pushed)
}

fn renew_in(
    store: &Arc<Store>,
    album: Uuid,
    conversation_id: ConvId,
    message: Message,
    uploads: &[MediaUpload],
    now: Millis,
) -> ChatResult<Released> {
    let mut gone = Vec::new();
    for upload in uploads.iter().filter(|upload| lapsed(upload, now)) {
        store.enqueue_upload(&again(upload), now)?;
        store.remove_upload(upload.id)?;
        gone.extend(upload.media_id);
    }
    let renewed = store.album_uploads(album)?;
    push(
        store,
        conversation_id,
        album,
        post_of(message)?,
        &renewed,
        now,
    )?;
    Ok(Released::Renewed(gone))
}

pub fn finish_renewals(store: &Arc<Store>) -> ChatResult<()> {
    let uploads = store.uploads()?;
    for upload in &uploads {
        let renewed = uploads.iter().any(|other| {
            other.album == upload.album
                && other.image_ref == upload.image_ref
                && other.created_at > upload.created_at
        });
        if renewed {
            store.remove_upload(upload.id)?;
        }
    }
    Ok(())
}

pub fn push(
    store: &Arc<Store>,
    conversation_id: ConvId,
    album: Uuid,
    mut post: Post,
    uploads: &[MediaUpload],
    now: Millis,
) -> ChatResult<Message> {
    let ready = ready(uploads);
    post.attachments = uploads
        .iter()
        .map(|upload| match ready {
            true => upload.attachment.clone(),
            false => placeholder(upload),
        })
        .collect();
    let envelope = envelope::encode(&Content::Post(post))?.encode_to_vec();
    Outbox::new(store.clone()).push(OutboxItem {
        client_id: album,
        conversation_id,
        class: MessageClass::Post,
        target_seq: None,
        envelope,
        created_at: now,
        attempts: 0,
        next_at: if ready { now } else { PARKED_AT },
    })
}

pub fn ready(uploads: &[MediaUpload]) -> bool {
    uploads
        .iter()
        .all(|upload| upload.state == UploadState::Committed)
}

pub fn pending_post(
    store: &Arc<Store>,
    conversation_id: ConvId,
    album: Uuid,
) -> ChatResult<Option<Message>> {
    Ok(Outbox::new(store.clone())
        .pending(conversation_id)?
        .into_iter()
        .find(|message| message.client_id == album))
}

fn again(upload: &MediaUpload) -> NewUpload {
    NewUpload {
        album: upload.album,
        position: upload.position,
        conversation_id: upload.conversation_id,
        kind: upload.kind,
        image_ref: upload.image_ref.clone(),
        thumb_ref: upload.thumb_ref.clone(),
        attachment: upload.attachment.clone(),
    }
}

fn lapsed(upload: &MediaUpload, now: Millis) -> bool {
    upload.state == UploadState::Committed
        && now.saturating_sub(upload.updated_at) >= ATTACH_LAPSE_MS
}

fn placeholder(upload: &MediaUpload) -> Attachment {
    let mut attachment = upload.attachment.clone();
    attachment.media_id = upload.id.to_string();
    if let Some(thumb) = attachment.thumb.as_mut() {
        thumb.media_id = upload.id.to_string();
    }
    attachment
}

fn post_of(message: Message) -> ChatResult<Post> {
    let MessageBody::Text(text) = message.body else {
        return Err(ChatError::Invalid);
    };
    Ok(Post {
        text,
        reply_to: message.reply_to,
        mentions: message.mentions,
        embeds: message.embeds,
        forwarded_from: message.forwarded_from,
        attachments: Vec::new(),
    })
}
