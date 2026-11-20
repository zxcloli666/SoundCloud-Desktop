import type { TFunction } from 'i18next';
import { failureOf } from '../../lib/voice/chat/failure.ts';

export function failureLine(code: string, t: TFunction): string {
  const failure = failureOf(code);
  if (failure === 'busy') return t('voice.chat.busy');
  if (failure === 'down') return t('voice.chat.down');
  if (failure === 'no_star') return t('voice.error.not_star');
  return t('voice.chat.lost');
}
