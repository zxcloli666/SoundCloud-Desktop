import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type DismissPort, dismiss } from '../src/lib/voice/hud.ts';
import type { HudView } from '../src/lib/voice/runtime';

type ChatHud = Extract<HudView, { kind: 'chat' }>;

function chatHud(phase: ChatHud['phase']): ChatHud {
  return { kind: 'chat', id: 'turn-1', heard: 'привет', phase, undo: null, line: '' };
}

function dismissed(hud: HudView): string[] {
  const calls: string[] = [];
  const port: DismissPort = {
    declineLink: (id) => calls.push(`decline:${id}`),
    stopChat: (id) => calls.push(`stop_chat:${id}`),
    cancelEngine: () => calls.push('cancel_engine'),
    hide: () => calls.push('hide'),
  };
  dismiss(hud, port);
  return calls;
}

test('closing the chat island stops the turn and the speech in every phase', () => {
  for (const phase of ['live', 'done', 'failed'] as const) {
    assert.deepEqual(
      dismissed(chatHud(phase)),
      ['stop_chat:turn-1', 'cancel_engine', 'hide'],
      phase,
    );
  }
});

test('closing a busy island cancels the engine, a finished one only hides', () => {
  const busy: HudView[] = [
    { kind: 'listening', source: 'hotkey' },
    { kind: 'thinking' },
    { kind: 'speaking' },
    {
      kind: 'asking',
      id: 'a',
      heard: 'хочу',
      first: {
        entity: { kind: 'track', name: 'Хочу', artist: '', popularity: 1, id: '1' },
        score: 1,
      },
      second: null,
    },
  ];
  for (const hud of busy) assert.deepEqual(dismissed(hud), ['cancel_engine', 'hide'], hud.kind);
  const quiet: HudView[] = [
    { kind: 'done', id: 'd', heard: 'пауза', items: [], undo: false, at: 0 },
    { kind: 'not_found', heard: 'абырвалг' },
    { kind: 'failed', display: 'Сейчас ничего не играет' },
    { kind: 'error', code: 'mic_denied' },
  ];
  for (const hud of quiet) assert.deepEqual(dismissed(hud), ['hide'], hud.kind);
});

test('closing a link question declines it and nothing else', () => {
  assert.deepEqual(dismissed({ kind: 'link_confirm', id: 'link-1', provider: 'alice' }), [
    'decline:link-1',
  ]);
});
