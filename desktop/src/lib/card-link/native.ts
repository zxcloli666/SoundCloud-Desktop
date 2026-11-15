import { listen } from '@tauri-apps/api/event';
import { trackedInvoke as invoke } from '../diagnostics';
import type { RunnerBundle } from '../pay-client';
import type { CardFields, FieldName } from './validate';

export type CardPhase = 'sending' | 'confirm' | 'checking';

export type RunnerOutcome =
  | { state: 'invalid'; field: FieldName }
  | { state: 'failed'; reason: string }
  | { state: 'page'; page_url: string }
  | { state: 'token'; token: string }
  | { state: 'succeeded'; reason?: string }
  | { state: 'pending'; reason?: string };

export type PageVisit =
  | { end: 'result'; outcome: RunnerOutcome }
  | { end: 'closed' }
  | { end: 'aborted' }
  | { end: 'refused' };

const PHASE_EVENT = 'card:phase';

export const cardNative = {
  open: (bundle: RunnerBundle, params: Record<string, unknown>) =>
    invoke<'card_form' | 'confirm'>('card_open', {
      bundle,
      params,
      env: { language: navigator.language, tz_offset: new Date().getTimezoneOffset() },
    }),
  submit: (card: CardFields) => invoke<RunnerOutcome>('card_submit', { card }),
  page: (url: string) => invoke<PageVisit>('card_page', { url }),
  abort: () => invoke<void>('card_abort'),
  close: () => invoke<void>('card_close'),
};

export function onCardPhase(handler: (phase: CardPhase) => void) {
  return listen<CardPhase>(PHASE_EVENT, (event) => handler(event.payload));
}

export function nativeCode(error: unknown): string {
  return typeof error === 'string' ? error : 'native';
}
