import { type ChatStep, chatResult } from './chat/step.ts';
import type { TurnEnd } from './chat/types';
import { entityReply, entityTitle, type Reply, reply } from './replies.ts';
import type { Entity, Intent, Outcome, VoiceCommand, VoiceLanguage } from './types';
import {
  type PlayerShot,
  pushStep,
  type RepeatMode,
  removeEntry,
  type Scope,
  scopeOf,
  stepsToRevert,
  topValid,
  type UndoEntry,
} from './undo.ts';

export interface PlayerPort {
  shot(): PlayerShot;
  restore(shot: PlayerShot, scope: Scope[]): Promise<void>;
  playEntity(entity: Entity): Promise<boolean>;
  queueEntity(entity: Entity): Promise<boolean>;
  playLikes(): Promise<boolean>;
  playWave(): Promise<boolean>;
  playSimilar(): Promise<boolean>;
  pause(): void;
  resume(): void;
  next(): void;
  previous(): void;
  seekTo(seconds: number): void;
  setVolume(volume: number): void;
  unmute(): void;
  setLiked(liked: boolean): Promise<boolean>;
  setShuffle(on: boolean): void;
  setRepeat(mode: RepeatMode): void;
}

export type StepKind = 'done' | 'ask' | 'not_found' | 'failed' | 'ignored' | 'chat' | 'cancelled';

export interface StepResult {
  kind: StepKind;
  outcome: Outcome;
  intent: Intent;
  entity: Entity | null;
  stack: UndoEntry[];
  chat?: TurnEnd;
}

export interface ExecuteContext {
  lang: VoiceLanguage;
  now: number;
  stack: UndoEntry[];
  chat?: (cmd: VoiceCommand, port: PlayerPort, ctx: ExecuteContext) => Promise<ChatStep>;
}

export const DEFAULT_SEEK_SECONDS = 10;
export const DEFAULT_VOLUME_STEP = 10;
export const VOLUME_MAX = 200;

const ENTITY_INTENTS = new Set<Intent>(['play', 'queue_add']);
const NEEDS_TRACK = new Set<Intent>([
  'pause',
  'resume',
  'stop',
  'next',
  'previous',
  'seek_forward',
  'seek_backward',
  'seek_to',
  'like',
  'unlike',
  'play_similar',
]);

export function needsTrack(intent: Intent): boolean {
  return NEEDS_TRACK.has(intent);
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(VOLUME_MAX, Math.round(v)));
}

function outcomeOf(r: Reply, ok: boolean, undo: boolean): Outcome {
  return { ok, speech: r.speech, display: r.display, undo };
}

function result(
  kind: StepKind,
  r: Reply,
  cmd: VoiceCommand,
  stack: UndoEntry[],
  entity: Entity | null = null,
  undo = false,
): StepResult {
  return { kind, outcome: outcomeOf(r, kind === 'done', undo), intent: cmd.intent, entity, stack };
}

async function perform(
  cmd: VoiceCommand,
  entity: Entity | null,
  port: PlayerPort,
  before: PlayerShot,
  lang: VoiceLanguage,
): Promise<Reply | null> {
  const n = cmd.number;
  switch (cmd.intent) {
    case 'play':
      return entity && (await port.playEntity(entity)) ? entityReply(lang, entity) : null;
    case 'queue_add':
      return entity && (await port.queueEntity(entity))
        ? reply(lang, 'queue_add', { name: entityTitle(entity) })
        : null;
    case 'play_likes':
      return (await port.playLikes()) ? reply(lang, 'play_likes') : null;
    case 'play_wave':
      return (await port.playWave()) ? reply(lang, 'play_wave') : null;
    case 'play_similar':
      return (await port.playSimilar()) ? reply(lang, 'play_similar') : null;
    case 'pause':
      port.pause();
      return reply(lang, 'pause');
    case 'stop':
      port.pause();
      return reply(lang, 'stop');
    case 'resume':
      port.resume();
      return reply(lang, 'resume');
    case 'next':
      port.next();
      return reply(lang, 'next');
    case 'previous':
      port.previous();
      return reply(lang, 'previous');
    case 'seek_forward': {
      const step = n ?? DEFAULT_SEEK_SECONDS;
      port.seekTo(before.position + step);
      return reply(lang, 'seek_forward', { n: step });
    }
    case 'seek_backward': {
      const step = n ?? DEFAULT_SEEK_SECONDS;
      port.seekTo(Math.max(0, before.position - step));
      return reply(lang, 'seek_backward', { n: step });
    }
    case 'seek_to':
      if (n === null) return null;
      port.seekTo(n);
      return reply(lang, 'seek_to', { n });
    case 'volume_set': {
      if (n === null) return null;
      const v = clampVolume(n);
      port.setVolume(v);
      return reply(lang, 'volume_set', { n: v });
    }
    case 'volume_up': {
      const v = clampVolume(before.volume + (n ?? DEFAULT_VOLUME_STEP));
      port.setVolume(v);
      return reply(lang, 'volume_up', { n: v });
    }
    case 'volume_down': {
      const v = clampVolume(before.volume - (n ?? DEFAULT_VOLUME_STEP));
      port.setVolume(v);
      return reply(lang, 'volume_down', { n: v });
    }
    case 'mute':
      port.setVolume(0);
      return reply(lang, 'mute');
    case 'unmute':
      port.unmute();
      return reply(lang, 'unmute');
    case 'like':
      return (await port.setLiked(true)) ? reply(lang, 'like') : null;
    case 'unlike':
      return (await port.setLiked(false)) ? reply(lang, 'unlike') : null;
    case 'shuffle_on':
      port.setShuffle(true);
      return reply(lang, 'shuffle_on');
    case 'shuffle_off':
      port.setShuffle(false);
      return reply(lang, 'shuffle_off');
    case 'repeat_one':
      port.setRepeat('one');
      return reply(lang, 'repeat_one');
    case 'repeat_all':
      port.setRepeat('all');
      return reply(lang, 'repeat_all');
    case 'repeat_off':
      port.setRepeat('off');
      return reply(lang, 'repeat_off');
    default:
      return null;
  }
}

export async function undoTop(port: PlayerPort, ctx: ExecuteContext): Promise<UndoEntry[] | null> {
  const entry = topValid(ctx.stack, ctx.now, port.shot());
  if (!entry) return null;
  return revert(entry, port, ctx.stack);
}

export async function revert(
  entry: UndoEntry,
  port: PlayerPort,
  stack: UndoEntry[],
): Promise<UndoEntry[]> {
  for (const step of stepsToRevert(entry)) await port.restore(step.before, step.scope);
  return removeEntry(stack, entry.id);
}

async function talk(cmd: VoiceCommand, port: PlayerPort, ctx: ExecuteContext): Promise<StepResult> {
  const help = cmd.intent === 'help';
  const plain = help
    ? result('done', reply(ctx.lang, 'help'), cmd, ctx.stack)
    : result('ignored', { speech: '', display: cmd.heard }, cmd, ctx.stack);
  if (!ctx.chat || !cmd.heard.trim() || cmd.source === 'remote') return plain;
  const res = chatResult(cmd, await ctx.chat(cmd, port, ctx), plain);
  return help && res.kind === 'failed' ? { ...plain, stack: res.stack } : res;
}

export async function execute(
  cmd: VoiceCommand,
  port: PlayerPort,
  ctx: ExecuteContext,
): Promise<StepResult> {
  const { lang, stack } = ctx;
  const decision = cmd.decision;

  if (decision?.decision === 'ask') {
    const first = entityTitle(decision.first.entity);
    const r = decision.second
      ? reply(lang, 'ask', { first, second: entityTitle(decision.second.entity) })
      : reply(lang, 'ask_one', { first });
    return result('ask', r, cmd, stack);
  }
  if (cmd.intent === 'none' || cmd.intent === 'help') return talk(cmd, port, ctx);

  if (cmd.intent === 'undo') {
    const next = await undoTop(port, ctx);
    if (!next) return result('failed', reply(lang, 'nothing_to_undo'), cmd, stack);
    return result('done', reply(lang, 'undo'), cmd, next);
  }

  const before = port.shot();

  if (cmd.intent === 'now_playing') {
    if (!before.track) return result('failed', reply(lang, 'nothing_playing'), cmd, stack);
    const r = reply(lang, 'now_playing', {
      name: before.track.title,
      artist: before.track.user.username,
    });
    return result('done', r, cmd, stack);
  }

  const entity = decision?.decision === 'act' ? decision.pick.entity : null;
  if (ENTITY_INTENTS.has(cmd.intent) && !entity) {
    return result('not_found', reply(lang, 'not_found', { heard: cmd.heard }), cmd, stack);
  }
  if (NEEDS_TRACK.has(cmd.intent) && !before.track) {
    return result('failed', reply(lang, 'nothing_playing'), cmd, stack);
  }

  let done: Reply | null;
  try {
    done = await perform(cmd, entity, port, before, lang);
  } catch {
    done = null;
  }
  if (!done) return result('failed', reply(lang, 'failed'), cmd, stack, entity);

  const scope = scopeOf(cmd.intent);
  if (scope.length === 0) return result('done', done, cmd, stack, entity);
  const after = port.shot();
  const next = pushStep(stack, cmd.group ?? cmd.id, { scope, before, after }, ctx.now);
  return result('done', done, cmd, next, entity, true);
}
