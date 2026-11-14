import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHAT_REST_MS, withRest } from '../src/lib/voice/chat/rest.ts';
import type { ChatStep } from '../src/lib/voice/chat/step';
import { MAX_ROUNDS, runTurn } from '../src/lib/voice/chat/turn.ts';
import { type ExecuteContext, execute } from '../src/lib/voice/execute.ts';
import type { Intent, VoiceCommand } from '../src/lib/voice/types';
import { bodyOf, ranOf } from './voice-chat-fakes.ts';
import { command, fakePort } from './voice-fake-port.ts';

const START = 1_000_000;

function line(refuse: string | null) {
  const state = { asked: 0, refuse, at: START };
  const send = withRest(
    async (_request, onEvent) => {
      state.asked += 1;
      if (state.refuse) throw { code: state.refuse };
      onEvent({ kind: 'say', text: 'Привет!' });
      onEvent({ kind: 'done' });
    },
    () => state.at,
  );
  const chat = async (
    cmd: VoiceCommand,
    _port: unknown,
    ctx: ExecuteContext,
  ): Promise<ChatStep> => {
    const end = await runTurn({
      id: cmd.id,
      speak: false,
      rounds: MAX_ROUNDS,
      signal: new AbortController().signal,
      body: bodyOf,
      send,
      act: async (name) => ranOf(name, false),
      onSay: () => {},
      onMark: () => {},
    });
    return { end, stack: ctx.stack, undo: false };
  };
  const say = (intent: Intent, heard: string) =>
    execute(command(intent, { heard }), fakePort(), {
      lang: 'ru',
      now: state.at,
      stack: [],
      chat,
    });
  return { state, say };
}

test('after a network or unavailable refusal the chat is left alone for 30 s', async () => {
  assert.equal(CHAT_REST_MS, 30_000);
  for (const code of ['network', 'unavailable']) {
    const { state, say } = line(code);
    const first = await say('none', 'как дела');
    assert.equal(first.kind, 'failed');
    assert.equal(state.asked, 1);

    state.at += CHAT_REST_MS - 1;
    const next = await say('none', 'ты тут');
    assert.equal(next.kind, 'failed');
    assert.deepEqual(next.chat, { status: 'failed', code, say: '', marks: [] });
    const help = await say('help', 'что умеешь');
    assert.equal(help.kind, 'done');
    assert.match(help.outcome.speech, /пауза.*громкость/);
    assert.equal(help.chat, undefined);
    assert.equal(state.asked, 1);
  }
});

test('the chat is asked again when the rest is over', async () => {
  const { state, say } = line('network');
  await say('none', 'как дела');
  state.at += CHAT_REST_MS;
  state.refuse = null;
  const back = await say('none', 'ты тут');
  assert.equal(back.kind, 'chat');
  assert.equal(back.outcome.display, 'Привет!');
  assert.equal(state.asked, 2);
  const help = await say('help', 'что умеешь');
  assert.equal(help.kind, 'chat');
  assert.equal(state.asked, 3);
});

test('a rest that ends on another refusal starts over', async () => {
  const { state, say } = line('network');
  await say('none', 'как дела');
  state.at += CHAT_REST_MS;
  await say('none', 'ты тут');
  assert.equal(state.asked, 2);
  state.at += CHAT_REST_MS - 1;
  await say('none', 'ало');
  assert.equal(state.asked, 2);
});

test('a refusal for another reason does not rest the chat', async () => {
  for (const code of ['star_required', 'rate_limited', 'session', 'bad_request']) {
    const { state, say } = line(code);
    const first = await say('none', 'как дела');
    assert.deepEqual(first.chat, { status: 'failed', code, say: '', marks: [] });
    await say('none', 'ты тут');
    assert.equal(state.asked, 2, code);
  }
});
