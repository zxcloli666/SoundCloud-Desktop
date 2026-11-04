use sc_chat::envelope::{self, Content, Post};
use sc_chat::outbox::OutboxItem;
use sc_chat::sc_chat_wire::prost::Message as _;
use sc_chat::{
    ChatError, ChatResult, ClientId, ConvId, ConversationKind, CoreEvent, DeleteScope, EMBEDS_MAX,
    Forwarded, GoneEvent, GoneMessage, HistoryQuery, Message, MessageBody, MessageRef,
    MessageTarget, RichText, SendInput, Seq, SpanKind, TEXT_MAX, UserId, embeds,
};

use super::reads::blocking;
use crate::chat::runtime::Core;
use crate::chat::state::ChatState;
use crate::chat::upload;

const EMOJI_MAX_BYTES: usize = 32;

pub async fn send(state: &ChatState, input: SendInput) -> ChatResult<Message> {
    if let Some(album) = input.client_id
        && upload::is_album(state, album).await
    {
        return upload::send_album(state, input, album).await;
    }
    let post = match input.forward {
        Some(source) => forwarded(state, source).await?,
        None => Post {
            mentions: mentions(&input.text),
            embeds: embeds::validate_all(&input.embeds)
                .into_iter()
                .take(EMBEDS_MAX)
                .collect(),
            text: input.text,
            reply_to: input.reply_to,
            forwarded_from: None,
            attachments: Vec::new(),
        },
    };
    if post.text.text.trim().is_empty() && post.embeds.is_empty() && post.attachments.is_empty() {
        return Err(ChatError::Invalid);
    }
    check_text(&post.text)?;
    queue(
        state,
        input.conversation_id,
        input.client_id,
        Content::Post(post),
    )
    .await
}

pub async fn edit(
    state: &ChatState,
    conversation_id: ConvId,
    target: Seq,
    text: RichText,
) -> ChatResult<Message> {
    if text.text.trim().is_empty() {
        return Err(ChatError::Invalid);
    }
    check_text(&text)?;
    queue(state, conversation_id, None, Content::Edit { target, text }).await
}

pub async fn react(
    state: &ChatState,
    conversation_id: ConvId,
    target: Seq,
    emoji: String,
    on: bool,
) -> ChatResult<()> {
    if emoji.is_empty() || emoji.len() > EMOJI_MAX_BYTES {
        return Err(ChatError::Invalid);
    }
    let reaction = Content::Reaction { target, emoji, on };
    queue(state, conversation_id, None, reaction)
        .await
        .map(|_| ())
}

pub async fn pin(
    state: &ChatState,
    conversation_id: ConvId,
    target: Seq,
    on: bool,
) -> ChatResult<()> {
    queue(state, conversation_id, None, Content::Pin { target, on })
        .await
        .map(|_| ())
}

pub async fn delete(
    state: &ChatState,
    conversation_id: ConvId,
    target: MessageTarget,
    scope: DeleteScope,
) -> ChatResult<()> {
    match (target, scope) {
        (MessageTarget::Pending(client_id), _) if upload::is_album(state, client_id).await => {
            upload::cancel_album(state, client_id).await
        }
        (MessageTarget::Pending(client_id), _) => {
            blocking(state, move |core| core.outbox.discard(client_id)).await
        }
        (MessageTarget::Seq(seq), DeleteScope::Everyone) => {
            state.api.delete_message(conversation_id, seq).await?;
            state.runtime.kick();
            Ok(())
        }
        (MessageTarget::Seq(seq), DeleteScope::Me) => {
            let gone = GoneMessage {
                conversation_id,
                seq,
            };
            blocking(state, move |core| core.store.hide_messages(&[gone])).await?;
            state.events.emit(CoreEvent::Gone(GoneEvent {
                conversations: Vec::new(),
                messages: vec![gone],
            }));
            Ok(())
        }
    }
}

pub async fn mark_read(state: &ChatState, conversation_id: ConvId, seq: Seq) -> ChatResult<()> {
    let core = state.core()?;
    state
        .rt
        .spawn_blocking(move || core.sync.queue_read(conversation_id, seq))
        .await
        .map_err(|_| ChatError::Internal)
}

pub async fn typing(state: &ChatState, conversation_id: ConvId) -> ChatResult<()> {
    if !state.runtime.may_type(conversation_id) {
        return Ok(());
    }
    state.api.typing(conversation_id).await
}

pub async fn focus(state: &ChatState, conversation_id: Option<ConvId>) -> ChatResult<()> {
    state.core()?.sync.set_focus(conversation_id);
    Ok(())
}

pub async fn queue(
    state: &ChatState,
    conversation_id: ConvId,
    client_id: Option<ClientId>,
    content: Content,
) -> ChatResult<Message> {
    let envelope = envelope::encode(&content)?.encode_to_vec();
    let now = state.runtime.now_ms();
    let item = OutboxItem {
        client_id: client_id.unwrap_or_else(uuid::Uuid::new_v4),
        conversation_id,
        class: content.class(),
        target_seq: content.target(),
        envelope,
        created_at: now,
        attempts: 0,
        next_at: now,
    };
    let message = blocking(state, move |core| core.outbox.push(item)).await?;
    state.runtime.kick();
    Ok(message)
}

async fn forwarded(state: &ChatState, source: MessageRef) -> ChatResult<Post> {
    blocking(state, move |core| forward_of(core, source)).await
}

fn forward_of(core: &Core, source: MessageRef) -> ChatResult<Post> {
    let conversation = core
        .store
        .conversation(source.conversation_id)?
        .ok_or(ChatError::NotFound)?;
    if conversation.kind == ConversationKind::Room {
        return Err(ChatError::Invalid);
    }
    let exact = HistoryQuery {
        before: None,
        after: Some(source.seq - 1),
        limit: 1,
    };
    let message = core
        .store
        .messages(source.conversation_id, &exact)?
        .messages
        .into_iter()
        .find(|message| message.seq == Some(source.seq))
        .ok_or(ChatError::NotFound)?;
    let MessageBody::Text(text) = message.body else {
        return Err(ChatError::Invalid);
    };
    let attachments = message
        .attachments
        .iter()
        .filter_map(|shown| {
            core.store
                .attachment(source.conversation_id, shown.media_id)
                .transpose()
        })
        .collect::<ChatResult<Vec<_>>>()?;
    let author = core.store.users(std::slice::from_ref(&message.sender))?;
    let forwarded_from = message.forwarded_from.unwrap_or_else(|| Forwarded {
        name: author
            .first()
            .map_or_else(|| message.sender.clone(), |user| user.name.clone()),
        user_id: message.sender,
        sent_at_ms: message.ts,
    });
    Ok(Post {
        mentions: Vec::new(),
        embeds: message.embeds,
        text,
        reply_to: None,
        forwarded_from: Some(forwarded_from),
        attachments,
    })
}

pub fn mentions(text: &RichText) -> Vec<UserId> {
    let mut users: Vec<UserId> = Vec::new();
    for span in &text.spans {
        if span.kind == SpanKind::Mention
            && let Some(user) = &span.user_id
            && !users.contains(user)
        {
            users.push(user.clone());
        }
    }
    users
}

pub fn check_text(text: &RichText) -> ChatResult<()> {
    if text.text.encode_utf16().count() > TEXT_MAX {
        return Err(ChatError::Invalid);
    }
    Ok(())
}
