import type { TFunction } from 'i18next';
import type { ChatError } from '../../../lib/chat/types';

const KNOWN = new Set(['read_limited', 'request_limit', 'offline', 'invalid', 'quota_exceeded']);

export function isRateLimit(error: ChatError | null): boolean {
  return error?.code === 'read_limited' || error?.code === 'request_limit';
}

export function errorText(error: ChatError | null, t: TFunction): string {
  const code = error && KNOWN.has(error.code) ? error.code : 'generic';
  return t(`chat.storage.errors.${code}`);
}
