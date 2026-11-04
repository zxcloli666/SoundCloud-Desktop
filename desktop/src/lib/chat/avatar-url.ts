import { chatMediaUrl } from './media-url';
import type { ConversationSummary } from './types';

export function groupAvatarUrl(conversation: ConversationSummary): string | null {
  if (conversation.kind !== 'group' || !conversation.avatarMediaId) return null;
  return chatMediaUrl(conversation.id, conversation.avatarMediaId, 'image');
}
