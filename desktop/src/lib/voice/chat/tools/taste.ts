import type { AppPort, Taste } from '../ports';
import type { ChatTool, ToolRun } from '../types';
import { fail, ok } from './intent.ts';

function tasted(taste: Taste): ToolRun {
  return taste === 'ok' ? { result: ok() } : fail(taste);
}

function dislike(app: AppPort): ChatTool {
  return {
    name: 'dislike',
    description:
      'Dislike the current track: it is skipped now and kept out of waves and recommendations. on=false removes the dislike of the current track.',
    args: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    returns: false,
    run: async (args) => tasted(await app.dislike(args.on === true)),
  };
}

function superlike(app: AppPort): ChatTool {
  return {
    name: 'superlike',
    description:
      'Superlike the current track, a stronger like that shapes recommendations most. Superlikes are limited: quota_full means the app now shows the user how to free one. on=false removes the superlike.',
    args: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    returns: false,
    run: async (args) => tasted(app.superlike(args.on === true)),
  };
}

export function tasteTools(app: AppPort): ChatTool[] {
  return [dislike(app), superlike(app)];
}
