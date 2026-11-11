import type { TFunction } from 'i18next';

export function failureLine(code: string, t: TFunction): string {
  if (code === 'rate_limited') return t('voice.chat.busy');
  if (code === 'unavailable') return t('voice.chat.down');
  if (code === 'star_required') return t('voice.error.not_star');
  return t('voice.chat.lost');
}
