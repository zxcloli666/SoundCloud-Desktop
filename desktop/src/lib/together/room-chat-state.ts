import type { RoomExit } from './room-rules.ts';

export type RoomChatLink = 'idle' | 'opening' | 'open' | 'off' | 'failed';

export interface RoomChatSnapshot {
  code: string | null;
  conversationId: string | null;
  link: RoomChatLink;
  exit: RoomExit | null;
  purged: boolean;
}

export interface RoomChatWish {
  code: string;
  chatId: string | null;
}

export type RoomChatStep =
  | { kind: 'none' }
  | { kind: 'open'; code: string }
  | { kind: 'move'; code: string }
  | { kind: 'clear' };

export const NO_ROOM_CHAT: RoomChatSnapshot = {
  code: null,
  conversationId: null,
  link: 'idle',
  exit: null,
  purged: false,
};

const NONE: RoomChatStep = { kind: 'none' };

const RETRY_MS = 15_000;
const NOT_MEMBER_RETRY_MS = 1_500;
const RETRY_MAX_MS = 120_000;
const RETRY_MAX_DOUBLINGS = 10;

export function retryDelay(
  code: string | null,
  retryMs: number | undefined,
  failures: number,
): number {
  const base =
    code === 'not_member'
      ? NOT_MEMBER_RETRY_MS
      : Math.max(retryMs ?? RETRY_MS, NOT_MEMBER_RETRY_MS);
  return Math.min(base * 2 ** Math.min(failures, RETRY_MAX_DOUBLINGS), RETRY_MAX_MS);
}

export function nextStep(state: RoomChatSnapshot, wish: RoomChatWish | null): RoomChatStep {
  if (!wish) return state.code !== null && state.exit === null ? { kind: 'clear' } : NONE;
  if (wish.code === state.code && state.exit === null) {
    return state.link === 'idle' ? { kind: 'open', code: wish.code } : NONE;
  }
  const sameChat = state.link === 'open' && !!wish.chatId && wish.chatId === state.conversationId;
  if (sameChat && state.exit === null) return { kind: 'move', code: wish.code };
  return { kind: 'open', code: wish.code };
}

export function opening(code: string): RoomChatSnapshot {
  return { ...NO_ROOM_CHAT, code, link: 'opening' };
}

export function opened(
  state: RoomChatSnapshot,
  code: string,
  conversationId: string,
): RoomChatSnapshot {
  if (state.code !== code || state.exit !== null) return state;
  return { ...state, conversationId, link: 'open', purged: false };
}

export function refused(state: RoomChatSnapshot, code: string, off: boolean): RoomChatSnapshot {
  if (state.code !== code || state.exit !== null) return state;
  return { ...state, link: off ? 'off' : 'failed' };
}

export function retry(state: RoomChatSnapshot): RoomChatSnapshot {
  return state.link === 'failed' ? { ...state, link: 'idle' } : state;
}

export function moved(state: RoomChatSnapshot, code: string): RoomChatSnapshot {
  return { ...state, code };
}

export function exited(state: RoomChatSnapshot, exit: RoomExit): RoomChatSnapshot {
  if (state.code === null) return state;
  return { ...state, exit };
}

export function gone(state: RoomChatSnapshot, conversations: string[]): RoomChatSnapshot {
  if (!state.conversationId || !conversations.includes(state.conversationId)) return state;
  return { ...state, purged: true };
}

export function showsThread(state: RoomChatSnapshot): boolean {
  return state.link === 'open' && state.exit === null && !state.purged;
}
