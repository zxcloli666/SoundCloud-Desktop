import type { ChatTool } from '../types';
import { NO_ARGS, ok } from './intent.ts';

function askUser(): ChatTool {
  return {
    name: 'ask_user',
    description:
      'Wait for the spoken answer to the question in your reply: the microphone opens right after you finish, no wake word needed. Use it whenever your reply asks the user something.',
    args: NO_ARGS,
    returns: false,
    run: async (_args, env) => {
      env.ask = true;
      return { result: ok() };
    },
  };
}

function talkMode(): ChatTool {
  return {
    name: 'talk_mode',
    description:
      'Start or end a conversation. While on, you keep listening after every reply, so the user just talks without the wake word or a button; a long silence ends it. Turn it on when the user wants to chat or keeps talking to you, off when they say goodbye or ask you to stop listening. talk_mode is in the context while on.',
    args: { type: 'object', properties: { on: { type: 'boolean' } }, required: ['on'] },
    returns: false,
    run: async (args, env) => {
      env.talk = args.on === true;
      return { result: ok() };
    },
  };
}

export function talkTools(): ChatTool[] {
  return [askUser(), talkMode()];
}
