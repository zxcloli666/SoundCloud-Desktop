import type { PlayerPort } from '../src/lib/voice/execute.ts';
import type { Entity, VoiceCommand } from '../src/lib/voice/types';
import type { PlayerShot, RepeatMode, Scope } from '../src/lib/voice/undo';

export function track(n: number) {
  return {
    id: n,
    urn: `soundcloud:tracks:${n}`,
    title: `Track ${n}`,
    duration: 200000,
    artwork_url: null,
    user: { id: 1, urn: 'soundcloud:users:1', username: 'Скриптонит', avatar_url: '' },
  } as never;
}

export function command(
  intent: VoiceCommand['intent'],
  extra: Partial<VoiceCommand> = {},
): VoiceCommand {
  return {
    id: extra.id ?? `c-${intent}`,
    source: 'typed',
    heard: extra.heard ?? intent,
    normalized: intent,
    intent,
    kind_hint: null,
    number: null,
    decision: null,
    ...extra,
  };
}

export function act(entity: Entity) {
  return { decision: 'act' as const, pick: { entity, score: 0.95 } };
}

export const ARTIST: Entity = {
  kind: 'artist',
  name: 'Скриптонит',
  artist: '',
  popularity: 1,
  id: 'a1',
};

export interface FakePort extends PlayerPort {
  state: PlayerShot;
  calls: string[];
}

export function fakePort(initial: Partial<PlayerShot> = {}): FakePort {
  const t1 = track(1);
  const state: PlayerShot = {
    track: t1,
    queue: [t1, track(2), track(3)],
    queueIndex: 0,
    originalQueue: null,
    position: 30,
    playing: true,
    volume: 40,
    shuffle: false,
    repeat: 'all',
    liked: false,
    ...initial,
  };
  const calls: string[] = [];
  const port: FakePort = {
    state,
    calls,
    shot: () => ({ ...state, queue: [...state.queue] }),
    restore: async (before: PlayerShot, scope: Scope[]) => {
      calls.push(`restore:${scope.join('+')}`);
      for (const part of scope) {
        if (part === 'volume') state.volume = before.volume;
        if (part === 'shuffle') state.shuffle = before.shuffle;
        if (part === 'repeat') state.repeat = before.repeat;
        if (part === 'like') state.liked = before.liked;
        if (part === 'playing') state.playing = before.playing;
        if (part === 'position') state.position = before.position;
        if (part === 'track' || part === 'queue') {
          state.track = before.track;
          state.queue = before.queue;
          state.queueIndex = before.queueIndex;
        }
      }
    },
    playEntity: async (entity: Entity) => {
      calls.push(`play:${entity.kind}:${entity.id}`);
      const first = track(100);
      state.track = first;
      state.queue = [first, track(101)];
      state.queueIndex = 0;
      return true;
    },
    queueEntity: async (entity: Entity) => {
      calls.push(`queue:${entity.id}`);
      state.queue = [...state.queue, track(200)];
      return true;
    },
    playLikes: async () => {
      calls.push('likes');
      return true;
    },
    playWave: async () => {
      calls.push('wave');
      return true;
    },
    playSimilar: async () => {
      calls.push('similar');
      return true;
    },
    pause: () => {
      calls.push('pause');
      state.playing = false;
    },
    resume: () => {
      calls.push('resume');
      state.playing = true;
    },
    next: () => calls.push('next'),
    previous: () => calls.push('previous'),
    seekTo: (seconds: number) => {
      calls.push(`seek:${seconds}`);
      state.position = seconds;
    },
    setVolume: (volume: number) => {
      calls.push(`volume:${volume}`);
      state.volume = volume;
    },
    unmute: () => calls.push('unmute'),
    setLiked: async (liked: boolean) => {
      calls.push(`liked:${liked}`);
      state.liked = liked;
      return true;
    },
    setShuffle: (on: boolean) => {
      calls.push(`shuffle:${on}`);
      state.shuffle = on;
    },
    setRepeat: (mode: RepeatMode) => {
      calls.push(`repeat:${mode}`);
      state.repeat = mode;
    },
  };
  return port;
}
