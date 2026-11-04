import { chatBridge } from '../../../lib/chat/bridge';
import type { ConversationSummary, CreateConversation, UserId } from '../../../lib/chat/types';
import { useChatListStore } from '../../../stores/chat/list';

export async function createChat(input: CreateConversation): Promise<ConversationSummary> {
  const summary = await chatBridge.create(input);
  useChatListStore.getState().upsert(summary);
  return summary;
}

export function createDirectChat(userId: UserId): Promise<ConversationSummary> {
  return createChat({ kind: 'direct', members: [userId], title: null });
}

export function createSavedChat(): Promise<ConversationSummary> {
  return createChat({ kind: 'self', members: [], title: null });
}
