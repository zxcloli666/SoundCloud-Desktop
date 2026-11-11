import type { AppPort } from '../ports';
import type { ArgsSchema, ChatTool } from '../types';
import { fail, ok } from './intent.ts';

const NOTE: ArgsSchema = {
  type: 'object',
  properties: { note: { type: 'string' } },
  required: ['note'],
};

export function memoryTools(app: AppPort): ChatTool[] {
  return [
    {
      name: 'remember',
      description:
        'Keep a short fact the user asked to remember, in one sentence. It comes back in notes.',
      args: NOTE,
      returns: false,
      run: async (args) => (app.remember(String(args.note)) ? { result: ok() } : fail('empty')),
    },
    {
      name: 'forget',
      description: 'Drop a remembered fact. Pass the note text as it appears in notes.',
      args: NOTE,
      returns: false,
      run: async (args) => {
        const removed = app.forget(String(args.note));
        return removed > 0 ? { result: ok({ removed }) } : fail('not_found');
      },
    },
  ];
}
