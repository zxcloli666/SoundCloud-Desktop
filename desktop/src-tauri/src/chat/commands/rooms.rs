use sc_chat::{
    ChatResult, ConversationSummary, Embed, RoomModeration, RoomPreview, RoomSettingsPatch,
};

use crate::chat::state::ChatState;

pub async fn chat(state: &ChatState, code: String) -> ChatResult<ConversationSummary> {
    let opened = state.api.room_chat(&code).await?;
    state
        .core()?
        .sync
        .adopt_room(opened.conversation_id, &code, opened.from_seq)
        .await
}

pub async fn preview(state: &ChatState, code: String) -> ChatResult<RoomPreview> {
    Ok(RoomPreview::from(&state.api.room_preview(&code).await?))
}

pub async fn moderate(state: &ChatState, code: String, action: RoomModeration) -> ChatResult<()> {
    state.api.room_moderate(&code, &action).await
}

pub async fn settings(state: &ChatState, code: String, patch: RoomSettingsPatch) -> ChatResult<()> {
    state.api.room_settings(&code, &patch).await.map(|_| ())
}

pub async fn suggest(state: &ChatState, code: String, track: Embed) -> ChatResult<()> {
    state.api.room_suggest(&code, &track).await
}
