import type { PlayerPort } from '../../execute.ts';
import { type AppPort, EFFECTS, type EffectName } from '../ports.ts';
import type { ChatTool } from '../types';
import { fail, ok } from './intent.ts';

const SLEEP_MOST = 600;
const SLEEP_WHEN = ['minutes', 'track_end', 'off'];

function sleepTimer(player: PlayerPort, app: AppPort): ChatTool {
  return {
    name: 'sleep_timer',
    description:
      'Pause the music later with a soft fade: in some minutes, at the end of the current track, or cancel the timer. A running timer is in the context as sleep_timer.',
    args: {
      type: 'object',
      properties: {
        when: { type: 'string', enum: SLEEP_WHEN },
        minutes: { type: 'integer' },
      },
      required: ['when'],
    },
    returns: false,
    run: async (args) => {
      if (args.when === 'off') {
        app.setSleep('off');
        return { result: ok() };
      }
      if (!player.shot().track) return fail('nothing_playing');
      if (args.when === 'track_end') {
        app.setSleep('track_end');
        return { result: ok() };
      }
      const minutes = Number(args.minutes);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > SLEEP_MOST) {
        return fail('bad_minutes', { allowed: `1-${SLEEP_MOST}` });
      }
      app.setSleep({ minutes });
      return { result: ok({ minutes }) };
    },
  };
}

function effect(app: AppPort): ChatTool {
  return {
    name: 'effect',
    description:
      'Turn on a sound effect or turn effects off: slowed_reverb is slower with reverb, sped_up is faster, eight_d circles the sound around the head, bass boosts the bass. The current one is in the context as effect.',
    args: {
      type: 'object',
      properties: { name: { type: 'string', enum: EFFECTS } },
      required: ['name'],
    },
    returns: false,
    run: async (args) => {
      app.setEffect(args.name as EffectName);
      return { result: ok() };
    },
  };
}

export function soundTools(player: PlayerPort, app: AppPort): ChatTool[] {
  return [sleepTimer(player, app), effect(app)];
}
