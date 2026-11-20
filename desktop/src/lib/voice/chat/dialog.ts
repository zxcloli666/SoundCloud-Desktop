import type { ChatMessage } from './types';

export const DIALOG_TTL_MS = 30 * 60 * 1000;
export const DIALOG_TURNS = 10;

export interface Exchange {
  at: number;
  user: string;
  assistant: string;
}

export function liveDialog(dialog: Exchange[], now: number): Exchange[] {
  const last = dialog[dialog.length - 1];
  return last && now - last.at <= DIALOG_TTL_MS ? dialog : [];
}

export function withExchange(dialog: Exchange[], exchange: Exchange): Exchange[] {
  if (!exchange.user.trim() || !exchange.assistant.trim()) return liveDialog(dialog, exchange.at);
  return [...liveDialog(dialog, exchange.at), exchange].slice(-DIALOG_TURNS);
}

export function dialogMessages(dialog: Exchange[], now: number): ChatMessage[] {
  return liveDialog(dialog, now).flatMap((e) => [
    { role: 'user' as const, text: e.user },
    { role: 'assistant' as const, text: e.assistant },
  ]);
}
