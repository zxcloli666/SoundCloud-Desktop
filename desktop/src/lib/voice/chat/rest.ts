import { failureCode } from './turn.ts';
import type { ChatEvent, ChatRequest } from './types';

export const CHAT_REST_MS = 30_000;

const DOWN = new Set(['network', 'unavailable']);

type Send = (request: ChatRequest, onEvent: (event: ChatEvent) => void) => Promise<void>;

export function withRest(send: Send, now: () => number = Date.now) {
  let rest: { code: string; until: number } | null = null;
  const resting = () => rest !== null && now() < rest.until;
  const rested: Send = (request, onEvent) => {
    if (rest && resting()) return Promise.reject({ code: rest.code });
    return send(request, onEvent).catch((err) => {
      const code = failureCode(err);
      if (DOWN.has(code)) rest = { code, until: now() + CHAT_REST_MS };
      throw err;
    });
  };
  return Object.assign(rested, { resting });
}
