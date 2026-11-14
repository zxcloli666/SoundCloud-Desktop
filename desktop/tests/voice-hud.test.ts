import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { TFunction } from 'i18next';
import { failureLine } from '../src/components/voice/chatFailure.ts';
import { afterError, type DismissPort, dismiss, voiceComing } from '../src/lib/voice/hud.ts';
import type { HudView } from '../src/lib/voice/runtime';

type ChatHud = Extract<HudView, { kind: 'chat' }>;

function chatHud(phase: ChatHud['phase']): ChatHud {
  return {
    kind: 'chat',
    id: 'turn-1',
    heard: 'привет',
    phase,
    undo: null,
    code: '',
    voiceLost: false,
  };
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

test('a speech failure keeps the chat island and marks the voice as lost', () => {
  for (const phase of ['live', 'done', 'failed'] as const) {
    assert.deepEqual(afterError(chatHud(phase), 'tts_failed'), {
      ...chatHud(phase),
      voiceLost: true,
    });
  }
});

test('other errors, and a speech failure outside a chat, show the error island', () => {
  assert.deepEqual(afterError(chatHud('live'), 'engine_missing'), {
    kind: 'error',
    code: 'engine_missing',
  });
  assert.deepEqual(afterError({ kind: 'speaking' }, 'tts_failed'), {
    kind: 'error',
    code: 'tts_failed',
  });
  assert.deepEqual(afterError({ kind: 'hidden' }, 'mic_denied'), {
    kind: 'error',
    code: 'mic_denied',
  });
});

test('each chat failure has its own line and unknown codes share one', () => {
  const key = ((name: string) => name) as TFunction;
  assert.equal(failureLine('rate_limited', key), 'voice.chat.busy');
  assert.equal(failureLine('unavailable', key), 'voice.chat.down');
  assert.equal(failureLine('star_required', key), 'voice.error.not_star');
  for (const code of ['deadline', 'provider_failed', 'network', 'failed', '']) {
    assert.equal(failureLine(code, key), 'voice.chat.lost');
  }
});

test('chat failure lines are written in all five interface languages', () => {
  const lines = (lang: string): string[] => {
    const file = new URL(`../src/i18n/locales/voice/${lang}.json`, import.meta.url);
    const { chat } = JSON.parse(readFileSync(file, 'utf8')).voice;
    return [chat.busy, chat.down, chat.lost];
  };
  const english = lines('en');
  for (const lang of ['ru', 'tr', 'ko', 'pt']) {
    lines(lang).forEach((line, i) => {
      assert.ok(line, `${lang} line ${i}`);
      assert.notEqual(line, english[i], `${lang} line ${i} is not translated`);
    });
  }
});

test('a written reply waits on screen while its voice is still being made', () => {
  assert.equal(voiceComing(chatHud('done'), 'thinking', null), true);
});

test('no voice is awaited while the reply is written, once it sounds, or after it', () => {
  assert.equal(voiceComing(chatHud('live'), 'thinking', null), false);
  assert.equal(voiceComing(chatHud('done'), 'speaking', null), false);
  assert.equal(voiceComing(chatHud('done'), 'idle', null), false);
  assert.equal(voiceComing(chatHud('failed'), 'thinking', null), false);
  assert.equal(voiceComing({ kind: 'thinking' }, 'thinking', null), false);
});

test('a voice preview in the settings does not hold the reply on screen', () => {
  assert.equal(voiceComing(chatHud('done'), 'thinking', 'loli'), false);
});
