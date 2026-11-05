import type {
  ConversationSummary,
  Message,
  NotifyPrefs,
  SystemEvent,
  UserId,
} from '../../../lib/chat/types';
import { isRequest } from '../../../stores/chat/list';
import { isMuted, isMutedForever } from '../list/mute';

const FRESH_MS = 60_000;
const ROOM_ALERTS = new Set(['kicked', 'banned', 'muted', 'handoff']);

export interface ToastContext {
  now: number;
  bootAt: number;
  focused: boolean;
  openId: string | null;
  myId: UserId | null;
  prefs: NotifyPrefs | undefined;
}

function isRoomAlert(event: SystemEvent, myId: UserId | null): boolean {
  return ROOM_ALERTS.has(event.kind) && myId !== null && event.target === myId;
}

function passesMute(message: Message, conversation: ConversationSummary, now: number): boolean {
  if (conversation.kind === 'room' || conversation.notify === 'mentions') return message.mentionsMe;
  if (!isMuted(conversation, now)) return true;
  return message.mentionsMe && conversation.kind === 'group' && !isMutedForever(conversation, now);
}

export function shouldToast(
  message: Message,
  conversation: ConversationSummary | undefined,
  context: ToastContext,
): boolean {
  if (message.mine || !conversation || !context.focused) return false;
  if (context.prefs && !context.prefs.enabled) return false;
  if (context.openId === message.conversationId) return false;
  if (message.ts < context.bootAt || context.now - message.ts > FRESH_MS) return false;
  if (message.expiresAt !== null && message.expiresAt <= context.now) return false;
  if (isRequest(conversation)) return false;
  if (message.body.type === 'system') return isRoomAlert(message.body, context.myId);
  if (message.body.type !== 'text') return false;
  return passesMute(message, conversation, context.now);
}
