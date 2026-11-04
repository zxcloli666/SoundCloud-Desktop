import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { addListener, isChatEvent, removeListener } from './bus';
import { runChatCommand } from './handlers';
import { routeIpcFetch } from './hybrid';
import { installLabPictures } from './pictures';
import { plainCommand } from './plain';

type Args = Record<string, unknown>;
type Invoke = (cmd: string, args?: InvokeArgs, options?: unknown) => Promise<unknown>;
type Internals = { invoke: Invoke };

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__;
}

let hybrid = false;

export function isHybrid(): boolean {
  return hybrid;
}

function eventCommand(cmd: string, args: Args): { answer: unknown } | null {
  if (!isChatEvent(args.event)) return null;
  if (cmd === 'plugin:event|listen') {
    addListener(args.event, args.handler as number);
    return { answer: args.handler };
  }
  if (cmd === 'plugin:event|unlisten') {
    removeListener(args.event, args.eventId as number);
    return { answer: null };
  }
  return null;
}

function chatArgs(args: InvokeArgs | undefined, options: unknown): Args {
  if (!(args instanceof Uint8Array) && !(args instanceof ArrayBuffer)) return (args ?? {}) as Args;
  const headers = (options as { headers?: Record<string, string> } | undefined)?.headers ?? {};
  return {
    data: args,
    conversationId: headers['x-chat-conversation'],
    album: headers['x-chat-album'] || null,
  };
}

async function labCommand(cmd: string, args: unknown, options: unknown) {
  const event = eventCommand(cmd, (args ?? {}) as Args);
  if (event) return event;
  if (!cmd.startsWith('chat_')) return null;
  return { answer: await runChatCommand(cmd, chatArgs(args as InvokeArgs | undefined, options)) };
}

export function installChatLabIpc() {
  installLabPictures();
  hybrid = '__TAURI_INTERNALS__' in window;
  if (hybrid) {
    routeIpcFetch(labCommand);
    return;
  }
  mockWindows('main');
  mockIPC((cmd, args) => plainCommand(cmd, args as Args | undefined), {
    shouldMockEvents: true,
  });
  const inner = internals().invoke;
  internals().invoke = async (cmd, args, options) => {
    const handled = await labCommand(cmd, args, options);
    return handled ? handled.answer : inner(cmd, args, options);
  };
}
