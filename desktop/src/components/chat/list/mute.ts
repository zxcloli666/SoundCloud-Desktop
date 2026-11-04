import type { ConversationSummary, Mute } from '../../../lib/chat/types';

const HOUR_MS = 3_600_000;
const FOREVER_AFTER_MS = 20 * 365 * 24 * HOUR_MS;

export function isMuted(conversation: ConversationSummary, now: number): boolean {
  if (conversation.notify === 'none') return true;
  return conversation.mutedUntil !== null && conversation.mutedUntil > now;
}

export function isMutedForever(conversation: ConversationSummary, now: number): boolean {
  if (conversation.notify === 'none') return true;
  return conversation.mutedUntil !== null && conversation.mutedUntil - now > FOREVER_AFTER_MS;
}

export function muteForHours(hours: number, now: number): Mute {
  return { kind: 'until', at: now + hours * HOUR_MS };
}

export function unreadLabel(count: number): string {
  return count > 99 ? '99+' : String(count);
}
