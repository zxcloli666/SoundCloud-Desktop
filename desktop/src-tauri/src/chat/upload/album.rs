use std::sync::Arc;

use sc_chat::envelope::Post;
use sc_chat::outbox::Outbox;
use sc_chat::store::{MediaUpload, Store};
use sc_chat::{
    ChatError, ChatResult, EMBEDS_MAX, MediaKind, Message, Millis, SendInput, UploadState, embeds,
};
use uuid::Uuid;

use super::deletes;
use super::driver::file_names;
use super::engine::Uploads;
use super::post::{Posted, Released, posted, push, ready, release_in};
use crate::app::diagnostics;
use crate::chat::commands::compose::{check_text, mentions};

impl Uploads {
    pub async fn send_album(&self, input: SendInput, album: Uuid) -> ChatResult<Message> {
        let albums = self.albums.lock().await;
        let now = self.now();
        let (message, ready, restarted) = self
            .blocking(move |store| park(store, input, album, now))
            .await?;
        drop(albums);
        if ready {
            self.host.sent();
        }
        self.kick();
        self.delete_on_server(restarted).await;
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
            Ok(released) => self.released(released).await,
            Err(error) => diagnostics::warn(format!("[ChatUpload] album release: {error}")),
        }
    }

    pub(super) async fn released(&self, released: Released) {
        match released {
            Released::Waiting => {}
            Released::Pushed => self.host.sent(),
            Released::Freed(rows) => {
                self.seed_cache(&rows).await;
                self.files
                    .remove(rows.iter().flat_map(file_names).collect())
                    .await;
            }
            Released::Renewed(lapsed) => {
                self.delete_on_server(lapsed).await;
                self.kick();
            }
        }
    }

    pub async fn cancel_album(&self, album: Uuid) -> ChatResult<()> {
        let albums = self.albums.lock().await;
        let (removed, out) = self
            .blocking(move |store| {
                let uploads = store.album_uploads(album)?;
                let out = match uploads.first() {
                    Some(first) => !matches!(
                        posted(store, first.conversation_id, album, &uploads)?,
                        Posted::None | Posted::Parked(_)
                    ),
                    None => false,
                };
                let removed = store.remove_album_uploads(album)?;
                Outbox::new(store.clone()).discard(album)?;
                Ok((removed, out))
            })
            .await?;
        drop(albums);
        let (sent, unsent): (Vec<_>, Vec<_>) = removed
            .into_iter()
            .partition(|upload| out && upload.state == UploadState::Committed);
        self.dropped(unsent).await;
        self.released(Released::Freed(sent)).await;
        Ok(())
    }

    pub(super) async fn dropped(&self, removed: Vec<MediaUpload>) {
        let ids: Vec<Uuid> = removed.iter().map(|upload| upload.id).collect();
        self.abort_if_current(&ids);
        self.discard(removed).await;
    }

    pub(super) async fn discard(&self, removed: Vec<MediaUpload>) {
        for upload in &removed {
            self.forget_targets(upload.id);
        }
        self.files
            .remove(removed.iter().flat_map(file_names).collect())
            .await;
        let media = removed
            .iter()
            .filter_map(|upload| upload.media_id)
            .collect();
        self.delete_on_server(media).await;
    }
}

fn park(
    store: &Arc<Store>,
    input: SendInput,
    album: Uuid,
    now: Millis,
) -> ChatResult<(Message, bool, Vec<Uuid>)> {
    let conversation_id = input.conversation_id;
    let uploads = store.album_uploads(album)?;
    let foreign = |upload: &MediaUpload| {
        upload.conversation_id != conversation_id || upload.kind != MediaKind::Image
    };
    if uploads.is_empty() || uploads.iter().any(foreign) || input.forward.is_some() {
        return Err(ChatError::Invalid);
    }
    let mut restarted = Vec::new();
    for upload in uploads
        .iter()
        .filter(|upload| upload.state == UploadState::Failed)
    {
        restarted.extend(deletes::restarted(store, upload.id, now)?);
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
    Ok((message, ready(&uploads), restarted))
}
