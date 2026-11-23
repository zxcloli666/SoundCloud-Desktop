import { useSettingsStore } from '../../../stores/settings';
import { getDuration } from '../../audio';
import { getIsPremium } from '../../premium-cache';
import type { ExecuteContext, PlayerPort, StepResult } from '../execute';
import { playerPort } from '../player-port';
import { marked } from '../readings';
import { type HudView, useVoiceRuntime } from '../runtime';
import { type RowReply, useVoiceStore } from '../store';
import type { Entity, HeardEvent, VoiceCommand, VoiceSource } from '../types';
import { appPort, briefOf, screenNow } from './app-port';
import { effectNow, sleepNow } from './app-sound';
import { tasteNow } from './app-taste';
import { roomNow } from './app-together';
import { buildBody } from './body';
import { buildContext, candidatesOf, QUEUE_TAIL } from './context';
import { dialogMessages, withExchange } from './dialog';
import { chatAhead, startsAhead } from './early';
import { chatIpc } from './ipc';
import { addMark, appendSay, openReply } from './live';
import { currentPage } from './navigator';
import { pageName } from './pages';
import { withRest } from './rest';
import type { ChatStep } from './step';
import { chatTools, runTool, toolsOf } from './tools';
import { MAX_ROUNDS, runTurn } from './turn';
import type { CallResult, ChatBody, ChatTool, ToolEnv, TurnEnd } from './types';
import { type Turn, unansweredTurns } from './unanswered';

const REPLY_KEPT = 600;
const UNANSWERED_MS = 20_000;

const early = chatAhead(chatIpc.chat, (id) => void chatIpc.cancel(id).catch(() => {}));
const send = withRest(early.send);

interface Active extends Turn {
  abort: AbortController;
}

let active: Active | null = null;
const unanswered = unansweredTurns(UNANSWERED_MS);

export function chatOn(): boolean {
  return useVoiceStore.getState().config.llm && getIsPremium();
}

export function stopChat(id: string) {
  if (active?.id === id) {
    unanswered.leave(active, Date.now());
    active.abort.abort();
  }
  void chatIpc.cancel(id).catch(() => {});
}

export function interruptChat() {
  if (active) stopChat(active.id);
}

function voiced(source: VoiceSource): boolean {
  return source !== 'typed';
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
    screen: screenNow(),
    now: new Date(),
    appLanguage: useSettingsStore.getState().language,
    extras: {
      ...tasteNow(shot.track?.urn),
      sleep: sleepNow(Date.now()),
      effect: effectNow(),
      room: roomNow(),
      talking: useVoiceRuntime.getState().talking,
    },
  });
}

function liveHud(cmd: VoiceCommand): HudView {
  return {
    kind: 'chat',
    id: cmd.id,
    heard: cmd.heard,
    phase: 'live',
    undo: null,
    code: '',
    voiceLost: false,
  };
}

export function openChatHud(cmd: VoiceCommand, said = '') {
  openReply();
  appendSay(said);
  useVoiceRuntime.getState().setHud(liveHud(cmd));
}

function speaks(source: VoiceSource): boolean {
  return voiced(source) && useVoiceStore.getState().config.speak.replies;
}

function bodyOf(
  heard: string,
  port: PlayerPort,
  tools: ChatTool[],
  candidates: Entity[],
  now: number,
  quiet: boolean,
) {
  const { config } = useVoiceStore.getState();
  const history = dialogMessages(useVoiceRuntime.getState().dialog, now);
  const body = (results: CallResult[]): ChatBody =>
    buildBody({
      text: heard,
      persona: config.speak.voice,
      language: config.language,
      context: contextNow(port, candidates),
      history,
      notes: useVoiceStore.getState().notes,
      tools,
      results,
      quiet,
      listener: config.listener,
      relation: config.relation,
    });
  return { tools, body };
}

export function startChatAhead(heard: HeardEvent) {
  if (!startsAhead(heard, { on: chatOn(), resting: send.resting() })) return;
  const tools = chatTools(playerPort, appPort, []);
  const now = Date.now();
  const text = unanswered.text(heard.id, heard.heard, now, active);
  const { body } = bodyOf(text, playerPort, tools, [], now, voiced(heard.source));
  early.start({ id: heard.id, speak: speaks(heard.source), body: body([]) });
}

export function keepChatAhead(id: string) {
  early.keepOnly(id);
}

export function dropChatAhead(id: string) {
  early.drop(id);
}

export async function chatStep(
  cmd: VoiceCommand,
  port: PlayerPort,
  ctx: ExecuteContext,
): Promise<ChatStep> {
  const env: ToolEnv = {
    cmd,
    lang: ctx.lang,
    now: ctx.now,
    stack: ctx.stack,
    undo: false,
    ask: false,
    talk: null,
  };
  const offered = toolsOf(cmd, port, appPort);
  const quiet = voiced(cmd.source);
  const text = unanswered.text(cmd.id, cmd.heard, ctx.now, active);
  const { tools, body } = bodyOf(text, port, offered, candidatesOf(cmd), ctx.now, quiet);
  const abort = new AbortController();
  const turn: Active = { id: cmd.id, heard: cmd.heard, abort, answered: false };
  active = turn;
  if (!send.resting()) openChatHud(cmd);
  const end = await runTurn({
    id: cmd.id,
    speak: speaks(cmd.source),
    rounds: MAX_ROUNDS,
    signal: abort.signal,
    body,
    send,
    act: (name, args) => runTool(tools, name, args, env),
    onSay: (delta) => {
      turn.answered = true;
      appendSay(delta);
    },
    onMark: (mark) => {
      turn.answered = true;
      addMark(mark);
    },
  }).finally(() => {
    if (active?.abort === abort) active = null;
  });
  if (end.status === 'ok') {
    unanswered.clear();
    if (end.kept) useVoiceStore.getState().learnReadings(marked(end.kept));
    const said = { at: Date.now(), user: text, assistant: end.kept ?? end.say };
    useVoiceRuntime.setState((s) => ({ dialog: withExchange(s.dialog, said) }));
  }
  return { end, stack: env.stack, undo: env.undo, ask: env.ask, talk: env.talk };
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
