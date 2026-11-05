import type { ConversationSummary, Message } from '../../../lib/chat/types';
import { canForwardFrom } from '../../../lib/together/room-rows';

const EDIT_WINDOW_MS = 48 * 3_600_000;

function isAdmin(conversation: ConversationSummary): boolean {
  return conversation.role === 'owner' || conversation.role === 'admin';
}

export function isActiveMember(conversation: ConversationSummary): boolean {
  return conversation.state === 'active' && conversation.accepted;
}

export function isRequest(conversation: ConversationSummary): boolean {
  return (
    conversation.state === 'invited' || (conversation.state === 'active' && !conversation.accepted)
  );
}

export function canEdit(message: Message, now: number): boolean {
  return (
    message.mine &&
    message.seq !== null &&
    message.body.type === 'text' &&
    now - message.ts < EDIT_WINDOW_MS &&
    (message.expiresAt === null || message.expiresAt > now)
  );
}

function moderates(conversation: ConversationSummary, roomModerator: boolean): boolean {
  if (conversation.kind === 'room') return roomModerator;
  return conversation.kind === 'group' && isAdmin(conversation);
}

export function canDeleteForEveryone(
  message: Message,
  conversation: ConversationSummary,
  roomModerator: boolean,
): boolean {
  if (message.seq === null || message.body.type === 'deleted') return false;
  if (message.mine) return conversation.kind !== 'self';
  return moderates(conversation, roomModerator);
}

export function canPin(conversation: ConversationSummary, roomModerator: boolean): boolean {
  if (!isActiveMember(conversation)) return false;
  if (conversation.kind === 'direct' || conversation.kind === 'self') return true;
  return moderates(conversation, roomModerator);
}

export function canReport(message: Message): boolean {
  return !message.mine && message.seq !== null && message.body.type === 'text';
}

export function hasTimer(conversation: ConversationSummary): boolean {
  return conversation.kind === 'direct' || conversation.kind === 'group';
}

export function canSetTimer(conversation: ConversationSummary): boolean {
  if (!hasTimer(conversation) || !isActiveMember(conversation)) return false;
  return conversation.kind === 'direct' || isAdmin(conversation);
}

export function canManageMembers(conversation: ConversationSummary): boolean {
  return conversation.kind === 'group' && isAdmin(conversation) && isActiveMember(conversation);
}

export function canForward(message: Message, conversation: ConversationSummary): boolean {
  return (
    message.seq !== null &&
    message.body.type === 'text' &&
    canForwardFrom(conversation.kind) &&
    !isRequest(conversation)
  );
}
