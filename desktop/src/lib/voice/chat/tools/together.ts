import { type AppPort, TOGETHER_ACTS, type TogetherAct } from '../ports.ts';
import type { ChatTool } from '../types';
import { fail, NO_ARGS, ok } from './intent.ts';

const COPIES: TogetherAct[] = ['start', 'invite'];

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function together(app: AppPort): ChatTool {
  return {
    name: 'together',
    description:
      'Listen together in a shared room. start opens one and copies the invite, open=true makes it public; join enters by a 6-character code, or the public room of a host from open_rooms, or the busiest public room when neither is given; invite copies the invite; visibility makes the room the user hosts public (open=true) or private; leave exits. The current room is in the context as together.',
    args: {
      type: 'object',
      properties: {
        act: { type: 'string', enum: [...TOGETHER_ACTS] },
        code: { type: 'string' },
        host: { type: 'string' },
        open: { type: 'boolean' },
      },
      required: ['act'],
    },
    returns: true,
    run: async (args) => {
      const act = args.act as TogetherAct;
      const done = await app.together({
        act,
        code: text(args.code),
        host: text(args.host),
        open: args.open === true,
      });
      if (done.state !== 'ok') return fail(done.state);
      const copied = COPIES.includes(act);
      return { result: ok({ code: done.code, ...(copied ? { invite_copied: true } : {}) }) };
    },
  };
}

function openRooms(app: AppPort): ChatTool {
  return {
    name: 'open_rooms',
    description:
      'List public listening rooms anyone can join: host name, what plays, listeners and capacity, busiest first. Join one with together act=join and its host.',
    args: NO_ARGS,
    returns: true,
    run: async () => {
      const rooms = await app.openRooms();
      if (!rooms) return fail('failed');
      return { result: ok({ rooms }) };
    },
  };
}

export function togetherTools(app: AppPort): ChatTool[] {
  return [together(app), openRooms(app)];
}
