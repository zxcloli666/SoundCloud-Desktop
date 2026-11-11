import type { HeardEvent } from '../types';
import type { ChatEvent, ChatRequest } from './types';

type Listener = (event: ChatEvent) => void;
type Send = (request: ChatRequest, onEvent: Listener) => Promise<void>;

interface Ahead {
  id: string;
  held: ChatEvent[];
  listener: Listener | null;
  closed: Promise<void>;
}

export function startsAhead(heard: HeardEvent, chat: { on: boolean; resting: boolean }): boolean {
  return chat.on && !chat.resting && heard.source !== 'remote' && heard.heard.trim() !== '';
}

async function release(turn: Ahead, onEvent: Listener): Promise<void> {
  for (let at = 0; at < turn.held.length; at++) {
    onEvent(turn.held[at]);
    await Promise.resolve();
  }
  turn.listener = onEvent;
  return turn.closed;
}

export function chatAhead(send: Send, cancel: (id: string) => void) {
  let ahead: Ahead | null = null;

  const leave = () => {
    if (!ahead) return;
    ahead.listener = () => {};
    cancel(ahead.id);
    ahead = null;
  };

  return {
    start(request: ChatRequest) {
      leave();
      const turn: Ahead = { id: request.id, held: [], listener: null, closed: Promise.resolve() };
      turn.closed = send(request, (event) => {
        if (turn.listener) turn.listener(event);
        else turn.held.push(event);
      });
      turn.closed.catch(() => {});
      ahead = turn;
    },
    keepOnly(id: string) {
      if (ahead?.id !== id) leave();
    },
    drop(id: string) {
      if (ahead?.id === id) leave();
    },
    send(request: ChatRequest, onEvent: Listener): Promise<void> {
      const turn = ahead;
      if (turn?.id !== request.id) return send(request, onEvent);
      ahead = null;
      return release(turn, onEvent);
    },
  };
}
