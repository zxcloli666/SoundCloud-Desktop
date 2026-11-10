import type { ChatEventMap, ChatEventName } from '../../../lib/chat/events';

interface Listener {
  event: string;
  handler: number;
}

type Internals = {
  runCallback?: (id: number, data: unknown) => void;
};

const listeners: Listener[] = [];

export function addListener(event: string, handler: number) {
  listeners.push({ event, handler });
}

export function removeListener(event: string, handler: number) {
  const index = listeners.findIndex((l) => l.event === event && l.handler === handler);
  if (index >= 0) listeners.splice(index, 1);
}

function run(handler: number, data: unknown) {
  const internals = (window as { __TAURI_INTERNALS__?: Internals }).__TAURI_INTERNALS__;
  if (internals?.runCallback) {
    internals.runCallback(handler, data);
    return;
  }
  (window as unknown as Record<string, (data: unknown) => void>)[`_${handler}`]?.(data);
}

export function emitChat<K extends ChatEventName>(event: K, payload: ChatEventMap[K]) {
  for (const listener of listeners) {
    if (listener.event === event) {
      run(listener.handler, { event, id: listener.handler, payload });
    }
  }
}

export function isChatEvent(event: unknown): event is string {
  return typeof event === 'string' && event.startsWith('chat:');
}
