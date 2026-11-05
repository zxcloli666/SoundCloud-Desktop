import { chatError } from '../../../../lib/chat/errors.ts';
import type { ChatError } from '../../../../lib/chat/types';

export type BackdropFix = 'retry' | 'star' | 'photo' | 'stored' | 'storage' | 'wait' | 'none';

export interface BackdropProblem {
  code: string;
  key: string;
  fix: BackdropFix;
  until: number | null;
  timeInText: boolean;
}

const FIXES: Record<string, BackdropFix> = {
  room_star_required: 'star',
  media_star_required: 'star',
  invalid: 'none',
  media_missing: 'photo',
  backdrop_cooldown: 'wait',
  request_limit: 'wait',
  quota_exceeded: 'storage',
  media_uploads_paused: 'retry',
  offline: 'retry',
};

const TIME_IN_TEXT = new Set(['backdrop_cooldown']);

const LIMIT_PAUSE_MS = 60_000;

function untilOf(chat: ChatError | null, code: string, now: number): number | null {
  if (chat?.until) return chat.until;
  if (chat?.retryMs) return now + chat.retryMs;
  return code === 'request_limit' ? now + LIMIT_PAUSE_MS : null;
}

export function backdropProblem(error: unknown, now: number): BackdropProblem {
  const chat: ChatError | null = chatError(error);
  const code: string = chat?.code ?? 'generic';
  const fix = FIXES[code] ?? 'retry';
  const until = untilOf(chat, code, now);
  return {
    code,
    key: `chat.backdrop.errors.${code in FIXES ? code : 'generic'}`,
    fix,
    until,
    timeInText: TIME_IN_TEXT.has(code),
  };
}

export function storedProblem(error: unknown, now: number): BackdropProblem {
  const problem = backdropProblem(error, now);
  if (problem.code !== 'media_missing') return problem;
  return { ...problem, key: 'chat.backdrop.errors.stored_gone', fix: 'stored' };
}
