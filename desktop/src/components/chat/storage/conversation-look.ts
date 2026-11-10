import type { TFunction } from 'i18next';
import { groupAvatarUrl } from '../../../lib/chat/avatar-url';
import type { ConversationKind, ConversationSummary } from '../../../lib/chat/types';
import { conversationAvatar, conversationTitle } from '../list/conversation-meta';

export interface ConversationLook {
  title: string;
  kind: ConversationKind;
  avatar: string | null;
}

export function lookOf(
  conversation: ConversationSummary | undefined,
  gone: boolean,
  t: TFunction,
): ConversationLook {
  if (!conversation) {
    return {
      title: t(gone ? 'chat.storage.chats.goneChat' : 'chat.storage.chats.someChat'),
      kind: 'group',
      avatar: null,
    };
  }
  return {
    title: conversationTitle(conversation, t),
    kind: conversation.kind,
    avatar: avatarOf(conversation),
  };
}

function avatarOf(conversation: ConversationSummary): string | null {
  return groupAvatarUrl(conversation) ?? conversationAvatar(conversation);
}
