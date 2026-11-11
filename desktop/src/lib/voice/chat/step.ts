import type { StepResult } from '../execute';
import { type ReplyKey, reply } from '../replies.ts';
import type { VoiceCommand, VoiceLanguage } from '../types';
import type { UndoEntry } from '../undo';
import type { TurnEnd } from './types';

export interface ChatStep {
  end: TurnEnd;
  stack: UndoEntry[];
  undo: boolean;
}

const FAILURES: Record<string, ReplyKey> = {
  rate_limited: 'chat_busy',
  unavailable: 'chat_down',
};

export function chatResult(
  cmd: VoiceCommand,
  lang: VoiceLanguage,
  step: ChatStep,
  ignored: StepResult,
): StepResult {
  const { end, stack, undo } = step;
  const base = { intent: cmd.intent, entity: null, stack, chat: end };
  if (end.status === 'cancelled') {
    return { kind: 'cancelled', outcome: { ok: false, speech: '', display: '', undo }, ...base };
  }
  if (end.status === 'failed') {
    const display = reply(lang, FAILURES[end.code] ?? 'chat_failed').display;
    return { kind: 'failed', outcome: { ok: false, speech: '', display, undo }, ...base };
  }
  if (!end.say.trim() && end.marks.length === 0) return { ...ignored, stack };
  return { kind: 'chat', outcome: { ok: true, speech: '', display: end.say, undo }, ...base };
}
