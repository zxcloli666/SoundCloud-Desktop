import type { TFunction } from 'i18next';
import { chatError } from '../../../lib/chat/errors';
import { shortDate } from '../../../lib/chat/time';
import { notifyError } from '../../../lib/notify';

const KNOWN: ReadonlySet<string> = new Set([
  'muted',
  'slow_mode',
  'not_member',
  'send_paused',
  'send_limited',
  'request_limit',
  'busy',
  'offline',
  'unavailable',
  'disabled',
  'too_young',
  'not_found',
  'invalid',
]);

export function errorText(error: unknown, t: TFunction, language: string): string {
  const chat = chatError(error);
  if (!chat) return t('chat.thread.errors.generic');
  if (chat.code === 'muted' && chat.until) {
    return t('chat.thread.errors.mutedUntil', {
      time: shortDate(chat.until, Date.now(), language),
    });
  }
  if (chat.code === 'slow_mode' && chat.retryMs) {
    return t('chat.thread.errors.slowMode', { count: Math.ceil(chat.retryMs / 1000) });
  }
  return t(`chat.thread.errors.${KNOWN.has(chat.code) ? chat.code : 'generic'}`);
}

export function toastError(error: unknown, t: TFunction, language: string) {
  notifyError(errorText(error, t, language));
}
