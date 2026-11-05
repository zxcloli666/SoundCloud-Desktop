pub(crate) mod compose;
mod conversations;
mod convert;
mod devices;
mod gallery;
mod media;
mod members;
mod reads;
mod rooms;
mod safety;

use sc_chat::api::wire::{
    DeleteAnswer, MediaSelection, MediaUsage, MinePage, RestoreAnswer, UrlsAnswer,
};
use sc_chat::{
    ChatConfig, ChatError, ChatRequest, ChatSettings, ChatStatus, ConvId, ConversationPage,
    ConversationPatch, ConversationSummary, CreateConversation, DeleteScope, Device, DeviceId,
    Embed, EmbedPage, EmbedsQuery, HistoryPage, HistoryQuery, Invite, InviteOptions, LinkClaimed,
    LinkCreated, LinkPoll, ListQuery, LoginBegin, LoginPoll, LoginTarget, MediaUploadView, Member,
    MemberRole, Message, MessageTarget, MineQuery, NotifyPrefs, ReportInput, ReportReason,
    RichText, RoomModeration, RoomPreview, RoomSettingsPatch, SearchHit, SearchQuery, SendInput,
    Seq, SettingsPatch, ThreadSnapshot, UserCard, UserId,
};
use tauri::State;
use uuid::Uuid;

use super::keychain::ResetPlan;
use super::login;
use super::runtime::DeviceLimit;
use super::state::ChatState;

#[tauri::command]
pub async fn chat_status(state: State<'_, ChatState>) -> Result<ChatStatus, ChatError> {
    Ok(state.status())
}

#[tauri::command]
pub async fn chat_keychain_retry(state: State<'_, ChatState>) -> Result<(), ChatError> {
    state.runtime.retry_keychain();
    Ok(())
}

#[tauri::command]
pub async fn chat_keys_reset(state: State<'_, ChatState>) -> Result<(), ChatError> {
    state.runtime.reset_keys().await
}

#[tauri::command]
pub async fn chat_keys_reset_plan(state: State<'_, ChatState>) -> Result<ResetPlan, ChatError> {
    Ok(state.runtime.reset_plan())
}

#[tauri::command]
pub async fn chat_device_limit(state: State<'_, ChatState>) -> Result<DeviceLimit, ChatError> {
    Ok(state.runtime.device_limit())
}

#[tauri::command]
pub async fn chat_config(state: State<'_, ChatState>) -> Result<ChatConfig, ChatError> {
    devices::config(&state).await
}

#[tauri::command]
pub async fn chat_login_begin(
    state: State<'_, ChatState>,
    target: LoginTarget,
) -> Result<LoginBegin, ChatError> {
    login::begin(&state, target).await
}

#[tauri::command]
pub async fn chat_login_poll(
    state: State<'_, ChatState>,
    login_request_id: String,
) -> Result<LoginPoll, ChatError> {
    login::poll(&state, &login_request_id).await
}

#[tauri::command]
pub async fn chat_link_create_pull(state: State<'_, ChatState>) -> Result<LinkCreated, ChatError> {
    login::link_create_pull(&state).await
}

#[tauri::command]
pub async fn chat_link_claim_push(
    state: State<'_, ChatState>,
    claim_token: String,
) -> Result<LinkClaimed, ChatError> {
    login::link_claim_push(&state, &claim_token).await
}

#[tauri::command]
pub async fn chat_link_poll(
    state: State<'_, ChatState>,
    link_request_id: String,
) -> Result<LinkPoll, ChatError> {
    login::link_poll(&state, &link_request_id).await
}

#[tauri::command]
pub async fn chat_list(
    state: State<'_, ChatState>,
    query: ListQuery,
) -> Result<ConversationPage, ChatError> {
    reads::list(&state, query).await
}

#[tauri::command]
pub async fn chat_open(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
) -> Result<ThreadSnapshot, ChatError> {
    reads::open(&state, conversation_id).await
}

#[tauri::command]
pub async fn chat_history(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    query: HistoryQuery,
) -> Result<HistoryPage, ChatError> {
    reads::history(&state, conversation_id, query).await
}

#[tauri::command]
pub async fn chat_images(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    before: Option<Seq>,
    limit: u32,
) -> Result<HistoryPage, ChatError> {
    gallery::images(&state, conversation_id, before, limit).await
}

#[tauri::command]
pub async fn chat_create(
    state: State<'_, ChatState>,
    input: CreateConversation,
) -> Result<ConversationSummary, ChatError> {
    conversations::create(&state, input).await
}

#[tauri::command]
pub async fn chat_conversation_update(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    patch: ConversationPatch,
) -> Result<ConversationSummary, ChatError> {
    conversations::update(&state, conversation_id, patch).await
}

#[tauri::command]
pub async fn chat_conversation_delete(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    scope: DeleteScope,
) -> Result<(), ChatError> {
    conversations::delete(&state, conversation_id, scope).await
}

#[tauri::command]
pub async fn chat_set_ttl(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    ttl_s: Option<u32>,
) -> Result<ConversationSummary, ChatError> {
    conversations::set_ttl(&state, conversation_id, ttl_s).await
}

#[tauri::command]
pub async fn chat_send(
    state: State<'_, ChatState>,
    input: SendInput,
) -> Result<Message, ChatError> {
    compose::send(&state, input).await
}

#[tauri::command]
pub async fn chat_edit(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    seq: Seq,
    text: RichText,
) -> Result<Message, ChatError> {
    compose::edit(&state, conversation_id, seq, text).await
}

#[tauri::command]
pub async fn chat_delete(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    target: MessageTarget,
    scope: DeleteScope,
) -> Result<(), ChatError> {
    compose::delete(&state, conversation_id, target, scope).await
}

#[tauri::command]
pub async fn chat_react(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    seq: Seq,
    emoji: String,
    on: bool,
) -> Result<(), ChatError> {
    compose::react(&state, conversation_id, seq, emoji, on).await
}

#[tauri::command]
pub async fn chat_pin(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    seq: Seq,
    on: bool,
) -> Result<(), ChatError> {
    compose::pin(&state, conversation_id, seq, on).await
}

#[tauri::command]
pub async fn chat_mark_read(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    seq: Seq,
) -> Result<(), ChatError> {
    compose::mark_read(&state, conversation_id, seq).await
}

#[tauri::command]
pub async fn chat_typing(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
) -> Result<(), ChatError> {
    compose::typing(&state, conversation_id).await
}

#[tauri::command]
pub async fn chat_focus(
    state: State<'_, ChatState>,
    conversation_id: Option<ConvId>,
) -> Result<(), ChatError> {
    compose::focus(&state, conversation_id).await
}

#[tauri::command]
pub async fn chat_draft_save(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    draft: Option<RichText>,
) -> Result<(), ChatError> {
    reads::save_draft(&state, conversation_id, draft).await
}

#[tauri::command]
pub async fn chat_search(
    state: State<'_, ChatState>,
    query: SearchQuery,
) -> Result<Vec<SearchHit>, ChatError> {
    reads::search(&state, query).await
}

#[tauri::command]
pub async fn chat_embeds(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    query: EmbedsQuery,
) -> Result<EmbedPage, ChatError> {
    reads::embeds(&state, conversation_id, query).await
}

#[tauri::command]
pub async fn chat_members(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
) -> Result<Vec<Member>, ChatError> {
    members::list(&state, conversation_id).await
}

#[tauri::command]
pub async fn chat_member_add(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    user_ids: Vec<UserId>,
) -> Result<Vec<Member>, ChatError> {
    members::add(&state, conversation_id, user_ids).await
}

#[tauri::command]
pub async fn chat_member_remove(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    user_id: UserId,
) -> Result<(), ChatError> {
    members::remove(&state, conversation_id, user_id).await
}

#[tauri::command]
pub async fn chat_member_role(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    user_id: UserId,
    role: MemberRole,
) -> Result<Member, ChatError> {
    members::set_role(&state, conversation_id, user_id, role).await
}

#[tauri::command]
pub async fn chat_accept(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
) -> Result<ConversationSummary, ChatError> {
    conversations::accept(&state, conversation_id).await
}

#[tauri::command]
pub async fn chat_decline(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
) -> Result<(), ChatError> {
    conversations::decline(&state, conversation_id).await
}

#[tauri::command]
pub async fn chat_requests(state: State<'_, ChatState>) -> Result<Vec<ChatRequest>, ChatError> {
    members::requests(&state).await
}

#[tauri::command]
pub async fn chat_invite_create(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    options: InviteOptions,
) -> Result<Invite, ChatError> {
    members::invite_create(&state, conversation_id, options).await
}

#[tauri::command]
pub async fn chat_invite_revoke(
    state: State<'_, ChatState>,
    token: String,
) -> Result<(), ChatError> {
    members::invite_revoke(&state, token).await
}

#[tauri::command]
pub async fn chat_invite_join(
    state: State<'_, ChatState>,
    token: String,
) -> Result<ConversationSummary, ChatError> {
    members::invite_join(&state, token).await
}

#[tauri::command]
pub async fn chat_block(state: State<'_, ChatState>, user_id: UserId) -> Result<(), ChatError> {
    safety::block(&state, user_id).await
}

#[tauri::command]
pub async fn chat_unblock(state: State<'_, ChatState>, user_id: UserId) -> Result<(), ChatError> {
    safety::unblock(&state, user_id).await
}

#[tauri::command]
pub async fn chat_report(
    state: State<'_, ChatState>,
    report: ReportInput,
) -> Result<(), ChatError> {
    safety::report(&state, report).await
}

#[tauri::command]
pub async fn chat_settings_get(state: State<'_, ChatState>) -> Result<ChatSettings, ChatError> {
    safety::settings(&state).await
}

#[tauri::command]
pub async fn chat_settings_put(
    state: State<'_, ChatState>,
    patch: SettingsPatch,
) -> Result<ChatSettings, ChatError> {
    safety::put_settings(&state, patch).await
}

#[tauri::command]
pub async fn chat_user_card(
    state: State<'_, ChatState>,
    user_id: UserId,
) -> Result<UserCard, ChatError> {
    safety::card(&state, user_id).await
}

#[tauri::command]
pub async fn chat_devices(state: State<'_, ChatState>) -> Result<Vec<Device>, ChatError> {
    devices::list(&state).await
}

#[tauri::command]
pub async fn chat_device_confirm(
    state: State<'_, ChatState>,
    device_id: DeviceId,
) -> Result<(), ChatError> {
    devices::confirm(&state, device_id).await
}

#[tauri::command]
pub async fn chat_device_not_me(
    state: State<'_, ChatState>,
    device_id: DeviceId,
) -> Result<(), ChatError> {
    devices::not_me(&state, device_id).await
}

#[tauri::command]
pub async fn chat_device_remove(
    state: State<'_, ChatState>,
    device_id: DeviceId,
) -> Result<(), ChatError> {
    devices::remove(&state, device_id).await
}

#[tauri::command]
pub async fn chat_room_chat(
    state: State<'_, ChatState>,
    code: String,
) -> Result<ConversationSummary, ChatError> {
    rooms::chat(&state, code).await
}

#[tauri::command]
pub async fn chat_room_preview(
    state: State<'_, ChatState>,
    code: String,
) -> Result<RoomPreview, ChatError> {
    rooms::preview(&state, code).await
}

#[tauri::command]
pub async fn chat_room_moderate(
    state: State<'_, ChatState>,
    code: String,
    action: RoomModeration,
) -> Result<(), ChatError> {
    rooms::moderate(&state, code, action).await
}

#[tauri::command]
pub async fn chat_room_settings(
    state: State<'_, ChatState>,
    code: String,
    patch: RoomSettingsPatch,
) -> Result<(), ChatError> {
    rooms::settings(&state, code, patch).await
}

#[tauri::command]
pub async fn chat_room_suggest(
    state: State<'_, ChatState>,
    code: String,
    track: Embed,
) -> Result<(), ChatError> {
    rooms::suggest(&state, code, track).await
}

#[tauri::command]
pub async fn chat_logout(state: State<'_, ChatState>) -> Result<(), ChatError> {
    devices::logout(&state).await
}

#[tauri::command]
pub async fn chat_notify_prefs(
    state: State<'_, ChatState>,
    prefs: Option<NotifyPrefs>,
) -> Result<NotifyPrefs, ChatError> {
    Ok(state.notifier.prefs(prefs))
}

#[tauri::command]
pub async fn chat_media_usage(state: State<'_, ChatState>) -> Result<MediaUsage, ChatError> {
    media::usage(&state).await
}

#[tauri::command]
pub async fn chat_media_mine(
    state: State<'_, ChatState>,
    query: MineQuery,
) -> Result<MinePage, ChatError> {
    media::mine(&state, query).await
}

#[tauri::command]
pub async fn chat_media_delete(
    state: State<'_, ChatState>,
    selection: MediaSelection,
) -> Result<DeleteAnswer, ChatError> {
    media::delete(&state, selection).await
}

#[tauri::command]
pub async fn chat_media_restore(
    state: State<'_, ChatState>,
    selection: MediaSelection,
) -> Result<RestoreAnswer, ChatError> {
    media::restore(&state, selection).await
}

#[tauri::command]
pub async fn chat_media_urls(
    state: State<'_, ChatState>,
    conversation_id: Option<ConvId>,
    ids: Vec<Uuid>,
) -> Result<UrlsAnswer, ChatError> {
    media::urls(&state, conversation_id, ids).await
}

#[tauri::command]
pub async fn chat_media_attach(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    album: Option<Uuid>,
    paths: Vec<String>,
) -> Result<Vec<MediaUploadView>, ChatError> {
    media::attach(&state, conversation_id, album, paths).await
}

#[tauri::command]
pub async fn chat_media_attach_data(
    state: State<'_, ChatState>,
    request: tauri::ipc::Request<'_>,
) -> Result<Vec<MediaUploadView>, ChatError> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|value| value.to_str().ok())
            .filter(|value| !value.is_empty())
            .map(Uuid::parse_str)
            .transpose()
            .map_err(|_| ChatError::Invalid)
    };
    let conversation_id = header("x-chat-conversation")?.ok_or(ChatError::Invalid)?;
    let album = header("x-chat-album")?;
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err(ChatError::Invalid);
    };
    media::attach_data(&state, conversation_id, album, data.clone()).await
}

#[tauri::command]
pub async fn chat_media_send(
    state: State<'_, ChatState>,
    input: SendInput,
    album: Uuid,
) -> Result<Message, ChatError> {
    media::send(&state, input, album).await
}

#[tauri::command]
pub async fn chat_media_album_cancel(
    state: State<'_, ChatState>,
    album: Uuid,
) -> Result<(), ChatError> {
    media::album_cancel(&state, album).await
}

#[tauri::command]
pub async fn chat_media_avatar(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    path: String,
) -> Result<MediaUploadView, ChatError> {
    media::avatar(&state, conversation_id, path).await
}

#[tauri::command]
pub async fn chat_room_backdrop(
    state: State<'_, ChatState>,
    code: String,
    conversation_id: ConvId,
    preset: Option<String>,
) -> Result<(), ChatError> {
    media::backdrop(&state, code, conversation_id, preset).await
}

#[tauri::command]
pub async fn chat_room_backdrop_upload(
    state: State<'_, ChatState>,
    code: String,
    conversation_id: ConvId,
    path: String,
) -> Result<MediaUploadView, ChatError> {
    media::backdrop_upload(&state, code, conversation_id, path).await
}

#[tauri::command]
pub async fn chat_room_backdrop_report(
    state: State<'_, ChatState>,
    conversation_id: ConvId,
    media_id: Uuid,
    reason: ReportReason,
    comment: Option<String>,
) -> Result<(), ChatError> {
    media::backdrop_report(&state, conversation_id, media_id, reason, comment).await
}

#[tauri::command]
pub async fn chat_media_uploads(
    state: State<'_, ChatState>,
) -> Result<Vec<MediaUploadView>, ChatError> {
    media::uploads(&state).await
}

#[tauri::command]
pub async fn chat_media_parked(state: State<'_, ChatState>) -> Result<Vec<Uuid>, ChatError> {
    media::parked(&state).await
}

#[tauri::command]
pub async fn chat_media_upload_retry(
    state: State<'_, ChatState>,
    id: Uuid,
) -> Result<(), ChatError> {
    media::upload_retry(&state, id).await
}

#[tauri::command]
pub async fn chat_media_upload_cancel(
    state: State<'_, ChatState>,
    id: Uuid,
) -> Result<(), ChatError> {
    media::upload_cancel(&state, id).await
}

#[tauri::command]
pub async fn chat_media_cache_size(state: State<'_, ChatState>) -> Result<u64, ChatError> {
    media::cache_size(&state).await
}

#[tauri::command]
pub async fn chat_media_retry(
    state: State<'_, ChatState>,
    media_id: Uuid,
) -> Result<(), ChatError> {
    super::download::forget(&state, media_id);
    Ok(())
}

#[tauri::command]
pub async fn chat_media_cache_clear(state: State<'_, ChatState>) -> Result<u64, ChatError> {
    media::cache_clear(&state).await
}

#[cfg(test)]
mod tests;
