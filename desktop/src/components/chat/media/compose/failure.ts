import type { TFunction } from 'i18next';
import { chatError } from '../../../../lib/chat/errors';
import type { ChatError } from '../../../../lib/chat/types';
import { notifyError } from '../../../../lib/notify';

export type FailureAction = 'retry' | 'storage' | 'star' | 'wait' | 'none';

export interface Failure {
  text: string;
  action: FailureAction;
}

const TEXTS: ReadonlySet<string> = new Set([
  'quota_exceeded',
  'media_star_required',
  'room_star_required',
  'media_uploads_paused',
  'media_missing',
  'send_limited',
  'not_member',
  'unavailable',
  'invalid',
  'offline',
  'busy',
  'not_ready',
  'crypto',
  'store',
  'request_limit',
  'read_limited',
  'disabled',
]);

const WAITS: ReadonlySet<string> = new Set([
  'media_uploads_paused',
  'send_limited',
  'request_limit',
  'read_limited',
  'busy',
]);

const HARD: ReadonlySet<string> = new Set([
  'room_star_required',
  'unavailable',
  'not_member',
  'disabled',
]);

function actionOf(code: string): FailureAction {
  if (code === 'quota_exceeded') return 'storage';
  if (code === 'media_star_required') return 'star';
  if (WAITS.has(code)) return 'wait';
  if (HARD.has(code)) return 'none';
  return 'retry';
}

export function failureOf(error: ChatError | null | undefined, t: TFunction): Failure {
  const code = error?.code ?? 'generic';
  return {
    text: t(`chat.media.errors.${TEXTS.has(code) ? code : 'generic'}`),
    action: error ? actionOf(code) : 'retry',
  };
}

export function shortcutLabel(mac: boolean): string {
  return mac ? '⌘U' : 'Ctrl+U';
}

export function notifyFailure(error: unknown, t: TFunction) {
  notifyError(failureOf(chatError(error), t).text);
}
