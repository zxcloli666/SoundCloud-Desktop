import { isActiveMember, isRequest } from '../../../lib/chat/membership';
import type { ConversationSummary, Member, Message, UserId } from '../../../lib/chat/types';
import { canForwardFrom } from '../../../lib/together/room-rows';

export { isActiveMember, isRequest };

const EDIT_WINDOW_MS = 48 * 3_600_000;

function isAdmin(conversation: ConversationSummary): boolean {
  return conversation.role === 'owner' || conversation.role === 'admin';
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

export function isPublicStaff(conversation: ConversationSummary): boolean {
  return conversation.kind === 'public' && isAdmin(conversation) && isActiveMember(conversation);
}

export function canSanction(
  conversation: ConversationSummary,
  target: UserId,
  me: UserId | null,
  staff: Member[],
): boolean {
  if (!isPublicStaff(conversation) || target === me) return false;
  if (conversation.role === 'owner') return true;
  return !staff.some((member) => member.user.id === target && member.role !== 'member');
}

function moderates(conversation: ConversationSummary, roomModerator: boolean): boolean {
  if (conversation.kind === 'room') return roomModerator;
  if (conversation.kind === 'public') return isPublicStaff(conversation);
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
