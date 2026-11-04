mod engine;
mod flight;
mod get;
mod local;
mod object;
mod open;
mod refused;
mod signed;

use std::sync::{Arc, OnceLock};

use sc_chat::sc_chat_wire::proto::Attachment;
use sc_chat::{ChatError, ChatResult, ConvId};
use serde::Serialize;
use tauri::Emitter;
use uuid::Uuid;

pub use self::engine::{Downloads, Notice, Routes};
use super::state::ChatState;

pub const MEDIA_STATE: &str = "chat:media-state";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Variant {
    Thumb,
    Image,
    Placeholder,
    UploadThumb,
    UploadImage,
}

impl Variant {
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "thumb" => Some(Self::Thumb),
            "image" => Some(Self::Image),
            "placeholder" => Some(Self::Placeholder),
            "upload-thumb" => Some(Self::UploadThumb),
            "upload-image" => Some(Self::UploadImage),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Part {
    Thumb,
    Image,
}

impl Part {
    pub fn label(self) -> &'static str {
        match self {
            Self::Thumb => "thumb",
            Self::Image => "image",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct MediaKey {
    pub conversation_id: ConvId,
    pub media_id: Uuid,
    pub variant: Variant,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Picture {
    pub bytes: Vec<u8>,
    pub mime: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Fetched {
    Image(Picture),
    Deleted,
    Lost,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Gone {
    Deleted,
    Lost,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaState {
    pub conversation_id: ConvId,
    pub media_id: Uuid,
    pub state: Gone,
}

pub async fn load(state: &ChatState, key: &MediaKey) -> ChatResult<Fetched> {
    let downloads = downloads(state);
    let key = *key;
    match key.variant {
        Variant::UploadThumb => local::upload(state, downloads, key, Part::Thumb).await,
        Variant::UploadImage => local::upload(state, downloads, key, Part::Image).await,
        Variant::Placeholder => match attachment(state, &key).await? {
            Some(attachment) => Ok(open::placeholder(attachment.thumbhash).await),
            None => Ok(Fetched::Lost),
        },
        Variant::Thumb => remote(state, downloads, key, Part::Thumb).await,
        Variant::Image => remote(state, downloads, key, Part::Image).await,
    }
}

async fn remote(
    state: &ChatState,
    downloads: &Arc<Downloads>,
    key: MediaKey,
    part: Part,
) -> ChatResult<Fetched> {
    match attachment(state, &key).await? {
        Some(attachment) => downloads.fetch(key.conversation_id, attachment, part).await,
        None => Ok(Fetched::Lost),
    }
}

async fn attachment(state: &ChatState, key: &MediaKey) -> ChatResult<Option<Attachment>> {
    let (conversation_id, media_id) = (key.conversation_id, key.media_id);
    let core = state.core()?;
    state
        .rt
        .spawn_blocking(move || core.store.attachment(conversation_id, media_id))
        .await
        .map_err(|_| ChatError::Internal)?
}

fn downloads(state: &ChatState) -> &'static Arc<Downloads> {
    static DOWNLOADS: OnceLock<Arc<Downloads>> = OnceLock::new();
    DOWNLOADS.get_or_init(|| {
        let app = state.app.clone();
        let notice: Notice = Arc::new(move |change: MediaState| {
            let _ = app.emit(MEDIA_STATE, change);
        });
        Arc::new(Downloads::new(
            state.api.clone(),
            state.media_cache.clone(),
            notice,
        ))
    })
}

#[cfg(test)]
mod tests;
