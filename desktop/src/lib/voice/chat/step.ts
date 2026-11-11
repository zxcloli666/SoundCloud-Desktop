import type { StepResult } from '../execute';
import type { VoiceCommand } from '../types';
import type { UndoEntry } from '../undo';
import type { TurnEnd } from './types';

export interface ChatStep {
  end: TurnEnd;
  stack: UndoEntry[];
  undo: boolean;
}

export function chatResult(cmd: VoiceCommand, step: ChatStep, ignored: StepResult): StepResult {
  const { end, stack, undo } = step;
  const base = { intent: cmd.intent, entity: null, stack, chat: end };
  if (end.status !== 'ok') {
    const kind = end.status === 'cancelled' ? 'cancelled' : 'failed';
    return { kind, outcome: { ok: false, speech: '', display: '', undo }, ...base };
  }
  if (!end.say.trim() && end.marks.length === 0) return { ...ignored, stack };
  return { kind: 'chat', outcome: { ok: true, speech: '', display: end.say, undo }, ...base };
}
