import type { TFunction } from 'i18next';
import { groupAvatarUrl } from '../../../lib/chat/avatar-url';
import type { ConversationSummary } from '../../../lib/chat/types';

export function conversationTitle(conversation: ConversationSummary, t: TFunction): string {
  if (conversation.kind === 'self') return t('chat.list.saved');
  if (conversation.kind === 'public') return t('chat.public.title');
  if (conversation.kind === 'direct') {
    return conversation.peer?.name ?? conversation.title ?? t('chat.list.unknown');
  }
  if (conversation.kind === 'room') return conversation.title ?? t('chat.list.room');
  return conversation.title ?? t('chat.list.untitledGroup');
}

export function conversationAvatar(conversation: ConversationSummary): string | null {
  return conversation.kind === 'direct'
    ? (conversation.peer?.avatarUrl ?? null)
    : (groupAvatarUrl(conversation) ?? conversation.avatarUrl);
}
