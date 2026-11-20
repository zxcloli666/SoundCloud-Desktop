import { Channel } from '@tauri-apps/api/core';
import { trackedInvoke as invoke } from '../../diagnostics';
import type { Entity, EntityKind } from '../types';
import type { ChatEvent, ChatRequest } from './types';

const TURN_WARN_MS = 60_000;

export const chatIpc = {
  chat: (turn: ChatRequest, onEvent: (event: ChatEvent) => void) => {
    const events = new Channel<ChatEvent>();
    events.onmessage = onEvent;
    return invoke<void>('voice_chat', { turn, events }, TURN_WARN_MS);
  },
  cancel: (id: string) => invoke<void>('voice_chat_cancel', { id }),
  resolve: (query: string, kinds: EntityKind[]) =>
    invoke<Entity[]>('voice_resolve', { query, kinds }),
};
