use std::sync::Arc;

use sc_chat::envelope::{self, Content, Post};
use sc_chat::outbox::{Outbox, OutboxItem};
use sc_chat::sc_chat_wire::prost::Message as _;
use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{
    ChatError, ChatResult, ConvId, EMBEDS_MAX, HistoryQuery, MediaKind, Message, MessageBody,
    MessageClass, Millis, SendInput, UploadState, embeds,
};
use uuid::Uuid;

use super::driver::file_names;
use super::engine::Uploads;
use crate::app::diagnostics;
use crate::chat::commands::compose::{check_text, mentions};

pub const PARKED_AT: Millis = Millis::MAX / 2;
const SENT_LOOKBACK: u32 = 100;

impl Uploads {
    pub async fn send_album(&self, input: SendInput, album: Uuid) -> ChatResult<Message> {
        let _albums = self.albums.lock().await;
        let now = self.now();
        let (message, released) = self
            .blocking(move |store| park(store, input, album, now))
            .await?;
        drop(_albums);
        self.finish(released).await;
        self.kick();
        Ok(message)
    }

    pub(super) async fn release(&self, album: Uuid) {
        let albums = self.albums.lock().await;
        let now = self.now();
        let released = self
            .blocking(move |store| release_in(store, album, now))
            .await;
        drop(albums);
        match released {
            Ok(released) => self.finish(released).await,
            Err(error) => diagnostics::warn(format!("[ChatUpload] album release: {error}")),
        }
    }

    pub async fn cancel_album(&self, album: Uuid) -> ChatResult<()> {
        let albums = self.albums.lock().await;
        let removed = self
            .blocking(move |store| {
                let removed = store.remove_album_uploads(album)?;
                Outbox::new(store.clone()).discard(album)?;
                Ok(removed)
            })
            .await?;
        drop(albums);
        self.dropped(removed).await;
        Ok(())
    }

    pub(super) async fn finish(&self, released: Vec<MediaUpload>) {
        if released.is_empty() {
            return;
        }
        self.files
            .remove(released.iter().flat_map(file_names).collect())
            .await;
        self.host.sent();
    }

    pub(super) async fn dropped(&self, removed: Vec<MediaUpload>) {
        let ids: Vec<Uuid> = removed.iter().map(|upload| upload.id).collect();
        self.abort_if_current(&ids);
        self.files
            .remove(removed.iter().flat_map(file_names).collect())
            .await;
        let media: Vec<Uuid> = removed
            .iter()
            .filter_map(|upload| upload.media_id)
            .collect();
        if media.is_empty() {
            return;
        }
        let selection = sc_chat::api::wire::MediaSelection::ids(media);
        if let Err(error) = self.api.delete_media(&selection).await {
            diagnostics::warn(format!("[ChatUpload] server delete: {error}"));
        }
    }
}

fn park(
    store: &Arc<Store>,
    input: SendInput,
    album: Uuid,
    now: Millis,
) -> ChatResult<(Message, Vec<MediaUpload>)> {
    let conversation_id = input.conversation_id;
    let uploads = store.album_uploads(album)?;
    let foreign = |upload: &MediaUpload| {
        upload.conversation_id != conversation_id || upload.kind != MediaKind::Image
    };
    if uploads.is_empty() || uploads.iter().any(foreign) || input.forward.is_some() {
        return Err(ChatError::Invalid);
    }
    for upload in uploads
        .iter()
        .filter(|upload| upload.state == UploadState::Failed)
    {
        store.upload_restart(upload.id, now)?;
    }
    let post = Post {
        mentions: mentions(&input.text),
        embeds: embeds::validate_all(&input.embeds)
            .into_iter()
            .take(EMBEDS_MAX)
            .collect(),
        text: input.text,
        reply_to: input.reply_to,
        forwarded_from: None,
        attachments: Vec::new(),
    };
    check_text(&post.text)?;
    let message = push(store, conversation_id, album, post, &uploads, now)?;
    let released = match ready(&uploads) {
        true => store.remove_album_uploads(album)?,
        false => Vec::new(),
    };
    Ok((message, released))
}

pub fn release_in(store: &Arc<Store>, album: Uuid, now: Millis) -> ChatResult<Vec<MediaUpload>> {
    let uploads = store.album_uploads(album)?;
    let Some(first) = uploads.first() else {
        return Ok(Vec::new());
    };
    if first.kind != MediaKind::Image || !ready(&uploads) {
        return Ok(Vec::new());
    }
    let conversation_id = first.conversation_id;
    match parked(store, conversation_id, album)? {
        Some(message) => {
            push(
                store,
                conversation_id,
                album,
                post_of(message)?,
                &uploads,
                now,
            )?;
            store.remove_album_uploads(album)
        }
        None if sent(store, conversation_id, album)? => store.remove_album_uploads(album),
        None => Ok(Vec::new()),
    }
}

pub fn repark_in(
    store: &Arc<Store>,
    album: Uuid,
    conversation_id: ConvId,
    now: Millis,
) -> ChatResult<Vec<MediaUpload>> {
    let Some(message) = parked(store, conversation_id, album)? else {
        return Ok(Vec::new());
    };
    let uploads = store.album_uploads(album)?;
    if ready(&uploads) && !uploads.is_empty() {
        return release_in(store, album, now);
    }
    let post = post_of(message)?;
    if !uploads.is_empty() {
        push(store, conversation_id, album, post, &uploads, now)?;
        return Ok(Vec::new());
    }
    if post.text.text.trim().is_empty() && post.embeds.is_empty() {
        Outbox::new(store.clone()).discard(album)?;
    } else {
        push(store, conversation_id, album, post, &[], now)?;
    }
    Ok(Vec::new())
}

fn push(
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

fn ready(uploads: &[MediaUpload]) -> bool {
    uploads
        .iter()
        .all(|upload| upload.state == UploadState::Committed)
}

fn placeholder(upload: &MediaUpload) -> Attachment {
    let mut attachment = upload.attachment.clone();
    attachment.media_id = upload.id.to_string();
    if let Some(thumb) = attachment.thumb.as_mut() {
        thumb.media_id = upload.id.to_string();
    }
    attachment
}

pub fn parked(
    store: &Arc<Store>,
    conversation_id: ConvId,
    album: Uuid,
) -> ChatResult<Option<Message>> {
    Ok(Outbox::new(store.clone())
        .pending(conversation_id)?
        .into_iter()
        .find(|message| message.client_id == album))
}

fn sent(store: &Store, conversation_id: ConvId, album: Uuid) -> ChatResult<bool> {
    let latest = HistoryQuery {
        before: None,
        after: None,
        limit: SENT_LOOKBACK,
    };
    Ok(store
        .messages(conversation_id, &latest)?
        .messages
        .iter()
        .any(|message| message.client_id == album))
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
