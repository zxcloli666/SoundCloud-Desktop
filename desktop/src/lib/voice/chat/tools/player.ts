import { type PlayerPort, undoTop } from '../../execute.ts';
import type { Intent } from '../../types';
import type { AppPort } from '../ports';
import type { ChatTool } from '../types';
import { fail, intentTool, NO_ARGS, ok, runIntent } from './intent.ts';

const SEEK: Record<string, Intent> = {
  forward: 'seek_forward',
  backward: 'seek_backward',
  to: 'seek_to',
};

const VOLUME: Record<string, Intent> = {
  set: 'volume_set',
  up: 'volume_up',
  down: 'volume_down',
  mute: 'mute',
  unmute: 'unmute',
};

const REPEAT: Record<string, Intent> = {
  off: 'repeat_off',
  one: 'repeat_one',
  all: 'repeat_all',
};

function seek(player: PlayerPort): ChatTool {
  return {
    name: 'seek',
    description: 'Move within the current track: forward or backward by seconds, or to a position.',
    args: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: Object.keys(SEEK) },
        seconds: { type: 'number' },
      },
      required: ['mode', 'seconds'],
    },
    returns: false,
    run: (args, env) =>
      runIntent(
        env,
        player,
        SEEK[String(args.mode)],
        Math.max(0, Math.round(Number(args.seconds))),
      ),
  };
}

function volume(player: PlayerPort): ChatTool {
  return {
    name: 'volume',
    description:
      'Change the volume. set needs value 0-200 (100 is normal); up and down take an optional step.',
    args: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: Object.keys(VOLUME) },
        value: { type: 'number' },
      },
      required: ['mode'],
    },
    returns: false,
    run: async (args, env) => {
      const value = typeof args.value === 'number' ? Math.abs(Math.round(args.value)) : null;
      if (args.mode === 'set' && value === null) return fail('bad_args:value');
      return runIntent(env, player, VOLUME[String(args.mode)], value);
    },
  };
}

function like(player: PlayerPort): ChatTool {
  return {
    name: 'like',
    description: 'Like the current track, or remove the like with on=false.',
    args: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    returns: false,
    run: (args, env) => runIntent(env, player, args.on ? 'like' : 'unlike'),
  };
}

function shuffle(player: PlayerPort): ChatTool {
  return {
    name: 'shuffle',
    description: 'Turn shuffle on or off.',
    args: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    returns: false,
    run: (args, env) => runIntent(env, player, args.on ? 'shuffle_on' : 'shuffle_off'),
  };
}

function repeat(player: PlayerPort): ChatTool {
  return {
    name: 'repeat',
    description: 'Set repeat: off, one (this track) or all (the queue).',
    args: {
      type: 'object',
      properties: { mode: { type: 'string', enum: Object.keys(REPEAT) } },
      required: ['mode'],
    },
    returns: false,
    run: (args, env) => runIntent(env, player, REPEAT[String(args.mode)]),
  };
}

function speed(app: AppPort): ChatTool {
  return {
    name: 'speed',
    description: 'Set the playback speed of the music, 0.5 to 2 (1 is normal).',
    args: { type: 'object', properties: { rate: { type: 'number' } }, required: ['rate'] },
    returns: false,
    run: async (args) => ({ result: ok({ rate: app.setSpeed(Number(args.rate)) }) }),
  };
}

function undo(player: PlayerPort): ChatTool {
  return {
    name: 'undo',
    description:
      'Undo the last thing done by voice: playback, volume, like, shuffle, repeat, queue.',
    args: NO_ARGS,
    returns: false,
    run: async (_args, env) => {
      const next = await undoTop(player, { lang: env.lang, now: env.now, stack: env.stack });
      if (!next) return { ...fail('nothing_to_undo'), intent: 'undo' };
      env.stack = next;
      return { result: ok(), intent: 'undo' };
    },
  };
}

export function playerTools(player: PlayerPort, app: AppPort): ChatTool[] {
  return [
    intentTool(player, 'pause', 'Pause playback.', 'pause'),
    intentTool(player, 'resume', 'Continue playback.', 'resume'),
    intentTool(player, 'next', 'Skip to the next track.', 'next'),
    intentTool(player, 'previous', 'Go back to the previous track.', 'previous'),
    seek(player),
    volume(player),
    like(player),
    shuffle(player),
    repeat(player),
    speed(app),
    intentTool(player, 'play_likes', 'Play the tracks the user liked.', 'play_likes'),
    intentTool(
      player,
      'play_wave',
      'Play the personal endless wave of recommendations.',
      'play_wave',
    ),
    intentTool(player, 'play_similar', 'Play tracks similar to the current one.', 'play_similar'),
    undo(player),
  ];
}
