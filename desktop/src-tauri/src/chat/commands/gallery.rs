use sc_chat::{ChatResult, ConvId, HistoryPage, HistoryQuery, Seq};

use super::reads::blocking;
use crate::chat::state::ChatState;

const IMAGES_MAX: u32 = 200;
const HISTORY_PAGE: u32 = 200;
const REACH_PAGES: usize = 4;

pub async fn images(
    state: &ChatState,
    conversation_id: ConvId,
    before: Option<Seq>,
    limit: u32,
) -> ChatResult<HistoryPage> {
    let limit = limit.clamp(1, IMAGES_MAX);
    let mut page = stored(state, conversation_id, before, limit).await?;
    let mut floor = stored_floor(state, conversation_id).await?;
    for _ in 0..REACH_PAGES {
        if page.more || page.messages.len() >= limit as usize {
            return Ok(page);
        }
        let query = HistoryQuery {
            before: floor,
            after: None,
            limit: HISTORY_PAGE,
        };
        let fetched = match state
            .core()?
            .sync
            .fetch_history(conversation_id, &query)
            .await
        {
            Ok(fetched) => fetched,
            Err(error) if page.messages.is_empty() => return Err(error),
            Err(_) => return Ok(HistoryPage { more: true, ..page }),
        };
        let older = reached(
            fetched.messages.iter().filter_map(|message| message.seq),
            floor,
        );
        page = stored(state, conversation_id, before, limit).await?;
        if older.is_none() || !fetched.more {
            return Ok(page);
        }
        floor = older;
    }
    Ok(HistoryPage { more: true, ..page })
}

pub fn reached(seqs: impl Iterator<Item = Seq>, floor: Option<Seq>) -> Option<Seq> {
    let oldest = seqs.filter(|seq| *seq > 0).min()?;
    match floor {
        Some(floor) if oldest >= floor => None,
        _ => Some(oldest),
    }
}

async fn stored(
    state: &ChatState,
    conversation_id: ConvId,
    before: Option<Seq>,
    limit: u32,
) -> ChatResult<HistoryPage> {
    blocking(state, move |core| {
        core.store.images_before(conversation_id, before, limit)
    })
    .await
}

async fn stored_floor(state: &ChatState, conversation_id: ConvId) -> ChatResult<Option<Seq>> {
    let query = HistoryQuery {
        before: None,
        after: Some(0),
        limit: 1,
    };
    let page = blocking(state, move |core| {
        core.store.messages(conversation_id, &query)
    })
    .await?;
    Ok(page
        .messages
        .iter()
        .filter_map(|message| message.seq)
        .find(|seq| *seq > 0))
}
