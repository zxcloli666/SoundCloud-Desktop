import { create } from 'zustand';
import type { RoomView } from '../lib/together/types';

export type TogetherPhase = 'idle' | 'connecting' | 'live' | 'reconnecting';
export type TogetherSync = 'synced' | 'catching-up' | 'waiting';

interface TogetherState {
  phase: TogetherPhase;
  room: RoomView | null;
  selfId: string | null;
  sync: TogetherSync;
  waitingFor: number;
}

export const useTogetherStore = create<TogetherState>(() => ({
  phase: 'idle',
  room: null,
  selfId: null,
  sync: 'synced',
  waitingFor: 0,
}));

export function isRoomHost(state: Pick<TogetherState, 'room' | 'selfId'>): boolean {
  return !!state.room && state.room.hostId === state.selfId;
}

export function isRoomGuest(state: Pick<TogetherState, 'room' | 'selfId'>): boolean {
  return !!state.room && state.room.hostId !== state.selfId;
}
