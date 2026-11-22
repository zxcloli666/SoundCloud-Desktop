import type { PlayerPort } from '../../execute.ts';
import { TRACK_LISTS, type TrackList } from '../../track-lists.ts';
import { pushStep } from '../../undo.ts';
import type { AppPort } from '../ports';
import type { ChatTool } from '../types';
import { fail, ok } from './intent.ts';

const SHOWN = 10;
const MOST = 30;

function whole(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function listTracks(app: AppPort): ChatTool {
  return {
    name: 'list_tracks',
    description:
      'Read a list of the user with numbers: queue (1 is the next track), likes, superlikes or history (1 is the last played). Returns n, title, artist and id. from and count page through it.',
    args: {
      type: 'object',
      properties: {
        list: { type: 'string', enum: TRACK_LISTS },
        from: { type: 'number' },
        count: { type: 'number' },
      },
      required: ['list'],
    },
    returns: true,
    run: async (args) => {
      const from = Math.max(1, whole(args.from, 1));
      const count = Math.min(MOST, Math.max(1, whole(args.count, SHOWN)));
      const tracks = await app.listTracks(args.list as TrackList, from, count);
      return { result: ok({ list: args.list, from, tracks }) };
    },
  };
}

function playList(player: PlayerPort): ChatTool {
  return {
    name: 'play_list',
    description:
      'Play the track with number n of a list and go on with the list after it: queue jumps to that upcoming track, likes and superlikes play on from it, history plays that track. A number said with a list ("the ninth in superlikes") is n, no need to list it first.',
    args: {
      type: 'object',
      properties: {
        list: { type: 'string', enum: TRACK_LISTS },
        n: { type: 'number' },
      },
      required: ['list', 'n'],
    },
    returns: false,
    run: async (args, env) => {
      const before = player.shot();
      const played = await player.playList(args.list as TrackList, whole(args.n, 0));
      if (!played) return fail('not_found');
      const after = player.shot();
      const step = { scope: ['track' as const], before, after };
      env.stack = pushStep(env.stack, env.cmd.group ?? env.cmd.id, step, env.now);
      env.undo = true;
      return {
        result: ok({ started: after.track?.title }),
        intent: 'play',
        text: after.track?.title,
      };
    },
  };
}

export function listTools(player: PlayerPort, app: AppPort): ChatTool[] {
  return [listTracks(app), playList(player)];
}
