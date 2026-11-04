import { chatError } from '../../../../lib/chat/errors';
import type { ChatError } from '../../../../lib/chat/types';

export type BackdropFix = 'retry' | 'star' | 'photo' | 'storage' | 'wait' | 'none';

export interface BackdropProblem {
  code: string;
  key: string;
  fix: BackdropFix;
  until: number | null;
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

export function backdropProblem(error: unknown, now: number): BackdropProblem {
  const chat: ChatError | null = chatError(error);
  const code: string = chat?.code ?? 'generic';
  const fix = FIXES[code] ?? 'retry';
  const until = chat?.until ?? (chat?.retryMs ? now + chat.retryMs : null);
  return { code, key: `chat.backdrop.errors.${code in FIXES ? code : 'generic'}`, fix, until };
}

export function isCooldown(problem: BackdropProblem | null): boolean {
  return problem?.code === 'backdrop_cooldown';
}
