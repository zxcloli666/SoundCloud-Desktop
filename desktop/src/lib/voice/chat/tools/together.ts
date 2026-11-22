import type { AppPort, TogetherAct } from '../ports';
import type { ChatTool } from '../types';
import { fail, ok } from './intent.ts';

const ACTS: TogetherAct[] = ['start', 'join', 'invite', 'leave'];

function together(app: AppPort): ChatTool {
  return {
    name: 'together',
    description:
      'Listen together with friends in a shared room. start opens a room and copies the invite for the user to send, open=true lets anyone find the room; invite copies the invite of the current room; join enters a room by its 6-character code in Latin letters and digits; leave exits the room. The current room is in the context as together.',
    args: {
      type: 'object',
      properties: {
        act: { type: 'string', enum: ACTS },
        code: { type: 'string' },
        open: { type: 'boolean' },
      },
      required: ['act'],
    },
    returns: true,
    run: async (args) => {
      const code = typeof args.code === 'string' ? args.code : '';
      const done = await app.together(args.act as TogetherAct, code, args.open === true);
      if (done.state !== 'ok') return fail(done.state);
      const copied = args.act === 'start' || args.act === 'invite';
      return { result: ok({ code: done.code, ...(copied ? { invite_copied: true } : {}) }) };
    },
  };
}

export function togetherTools(app: AppPort): ChatTool[] {
  return [together(app)];
}
