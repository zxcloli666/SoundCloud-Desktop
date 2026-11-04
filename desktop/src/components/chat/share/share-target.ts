import type { TFunction } from 'i18next';
import type { ConversationSummary } from '../../../lib/chat/types';

export function targetTitle(t: TFunction, conversation: ConversationSummary): string {
  if (conversation.kind === 'self') return t('chat.embeds.share.saved');
  if (conversation.kind === 'room') return conversation.title || t('chat.embeds.share.room');
  return conversation.title || conversation.peer?.name || t('chat.embeds.share.untitled');
}

export function targetAvatar(conversation: ConversationSummary): string | null {
  return conversation.avatarUrl ?? conversation.peer?.avatarUrl ?? null;
}
