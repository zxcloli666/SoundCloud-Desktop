import type { InvokeArgs } from '@tauri-apps/api/core';
import { mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { addListener, isChatEvent, removeListener } from './bus';
import { runChatCommand } from './handlers';
import { installLabPictures } from './pictures';
import { plainCommand } from './plain';

type Args = Record<string, unknown>;
type Invoke = (cmd: string, args?: InvokeArgs, options?: unknown) => Promise<unknown>;
type Internals = { invoke: Invoke };

function internals(): Internals {
  return (window as unknown as { __TAURI_INTERNALS__: Internals }).__TAURI_INTERNALS__;
}

export function isHybrid(): boolean {
  return '__TAURI_INTERNALS__' in window;
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

export function installChatLabIpc() {
  installLabPictures();
  const hybrid = isHybrid();
  if (!hybrid) {
    mockWindows('main');
    mockIPC((cmd, args) => plainCommand(cmd, args as Args | undefined), {
      shouldMockEvents: true,
    });
  }
  const inner = internals().invoke;
  internals().invoke = (cmd, args, options) => {
    const event = eventCommand(cmd, (args ?? {}) as Args);
    if (event) return Promise.resolve(event.answer);
    if (cmd.startsWith('chat_')) return runChatCommand(cmd, (args ?? {}) as Args);
    return inner(cmd, args, options);
  };
}
