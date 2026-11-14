import { listen } from '@tauri-apps/api/event';
import { trackedInvoke as invoke } from '../diagnostics';
import type { BoostyCardStart } from '../pay-client';
import type { CardFields, FieldName } from './validate';

export type CardPhase = 'sending' | 'confirm' | 'checking';
export type BankPageEnd = 'closed' | 'done' | 'aborted';

export type CardVerdict =
  | { state: 'succeeded' }
  | { state: 'failed'; reason: string }
  | { state: 'invalid'; field: FieldName }
  | { state: 'tokenized'; token: string }
  | { state: 'timeout' };

const PHASE_EVENT = 'boosty-card:phase';

export const cardNative = {
  supported: () => invoke<boolean>('boosty_card_supported'),
  open: ({ bundle, params }: BoostyCardStart) =>
    invoke<void>('boosty_card_open', {
      bundle,
      params: {
        ...params,
        tz_offset: new Date().getTimezoneOffset(),
        language: navigator.language,
      },
    }),
  submit: (card: CardFields) => invoke<CardVerdict>('boosty_card_submit', { card }),
  page: (url: string) => invoke<BankPageEnd>('boosty_card_page', { url }),
  abort: () => invoke<void>('boosty_card_abort'),
  close: () => invoke<void>('boosty_card_close'),
};

export function onCardPhase(handler: (phase: CardPhase) => void) {
  return listen<CardPhase>(PHASE_EVENT, (event) => handler(event.payload));
}

export function nativeCode(error: unknown): string {
  return typeof error === 'string' ? error : 'native';
}
