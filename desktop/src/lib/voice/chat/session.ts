import { useSettingsStore } from '../../../stores/settings';
import { getDuration } from '../../audio';
import { getIsPremium } from '../../premium-cache';
import type { ExecuteContext, PlayerPort, StepResult } from '../execute';
import { useVoiceRuntime } from '../runtime';
import { type RowReply, useVoiceStore } from '../store';
import type { Entity, VoiceCommand, VoiceSource } from '../types';
import { appPort, briefOf } from './app-port';
import { buildBody } from './body';
import { buildContext, candidatesOf, QUEUE_TAIL } from './context';
import { dialogMessages, withExchange } from './dialog';
import { chatIpc } from './ipc';
import { addMark, appendSay, openReply } from './live';
import { currentPage } from './navigator';
import { pageName } from './pages';
import { withRest } from './rest';
import type { ChatStep } from './step';
import { chatTools, runTool } from './tools';
import { MAX_ROUNDS, runTurn } from './turn';
import type { ToolEnv, TurnEnd } from './types';

const REPLY_KEPT = 600;

const send = withRest(chatIpc.chat);

let active: { id: string; abort: AbortController } | null = null;

export function chatOn(): boolean {
  return useVoiceStore.getState().config.llm && getIsPremium();
}

export function stopChat(id: string) {
  if (active?.id === id) active.abort.abort();
  void chatIpc.cancel(id).catch(() => {});
}

export function interruptChat() {
  if (active) stopChat(active.id);
}

function voiced(source: VoiceSource): boolean {
  return source !== 'typed' && source !== 'remote';
}

function contextNow(port: PlayerPort, candidates: Entity[]): Record<string, unknown> {
  const shot = port.shot();
  return buildContext({
    track: shot.track ? briefOf(shot.track) : null,
    liked: shot.liked,
    position: shot.position,
    duration: getDuration() || (shot.track?.duration ?? 0) / 1000,
    playing: shot.playing,
    volume: shot.volume,
    shuffle: shot.shuffle,
    repeat: shot.repeat,
    next: appPort.upNext(QUEUE_TAIL),
    candidates,
    page: pageName(currentPage()),
    now: new Date(),
    appLanguage: useSettingsStore.getState().language,
  });
}

export async function chatStep(
  cmd: VoiceCommand,
  port: PlayerPort,
  ctx: ExecuteContext,
): Promise<ChatStep> {
  const { config } = useVoiceStore.getState();
  const env: ToolEnv = { cmd, lang: ctx.lang, now: ctx.now, stack: ctx.stack, undo: false };
  const candidates = candidatesOf(cmd);
  const tools = chatTools(port, appPort, candidates);
  const history = dialogMessages(useVoiceRuntime.getState().dialog, ctx.now);
  const abort = new AbortController();
  active = { id: cmd.id, abort };
  openReply();
  useVoiceRuntime.getState().setHud({
    kind: 'chat',
    id: cmd.id,
    heard: cmd.heard,
    phase: 'live',
    undo: null,
    code: '',
    voiceLost: false,
  });
  const end = await runTurn({
    id: cmd.id,
    speak: voiced(cmd.source) && config.speak.replies,
    rounds: MAX_ROUNDS,
    signal: abort.signal,
    body: (results) =>
      buildBody({
        text: cmd.heard,
        persona: config.speak.voice,
        language: config.language,
        context: contextNow(port, candidates),
        history,
        notes: useVoiceStore.getState().notes,
        tools,
        results,
      }),
    send,
    act: (name, args) => runTool(tools, name, args, env),
    onSay: appendSay,
    onMark: addMark,
  }).finally(() => {
    if (active?.abort === abort) active = null;
  });
  if (end.status === 'ok') {
    const said = { at: Date.now(), user: cmd.heard, assistant: end.say };
    useVoiceRuntime.setState((s) => ({ dialog: withExchange(s.dialog, said) }));
  }
  return { end, stack: env.stack, undo: env.undo };
}

export function closeChatHud(id: string, res: StepResult, undo: string | null) {
  const runtime = useVoiceRuntime.getState();
  const hud = runtime.hud;
  if (hud.kind !== 'chat' || hud.id !== id || !res.chat) return;
  if (res.chat.status === 'ok') runtime.setHud({ ...hud, phase: 'done', undo });
  else if (res.chat.status === 'cancelled') runtime.hideHud();
  else if (res.chat.code === 'star_required') runtime.setHud({ kind: 'error', code: 'not_star' });
  else runtime.setHud({ ...hud, phase: 'failed', code: res.chat.code });
}

export function rowReply(end: TurnEnd): RowReply {
  return {
    voice: useVoiceStore.getState().config.speak.voice,
    text: end.say.slice(0, REPLY_KEPT),
    marks: end.marks,
    failed: end.status === 'failed' ? end.code : undefined,
  };
}
