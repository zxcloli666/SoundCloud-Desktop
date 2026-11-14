import type { ConversationSummary } from './types';

export function isRequest(conversation: ConversationSummary): boolean {
  return conversation.state === 'invited';
}

export function isActiveMember(conversation: ConversationSummary): boolean {
  return conversation.state === 'active';
}
