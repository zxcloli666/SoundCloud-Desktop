import { isRoomHost, useTogetherStore } from '../../../stores/together';
import { ApiError } from '../../api';
import { roomsApi } from '../../together/api';
import { CODE_LENGTH, cleanCode } from '../../together/errors';
import { onlineGuests } from '../../together/link';
import {
  hostSession,
  joinOpenSession,
  joinSession,
  leaveSession,
  setRoomPublic,
  shareText,
} from '../../together/session';
import type { RoomShown } from './context';
import { pickOpen, showRooms } from './open-rooms';
import type { OpenRoomShown, TogetherAsk, TogetherDone } from './ports';

type Gone = 'bad_code' | 'no_open_room';

function roomCode(): string | null {
  return useTogetherStore.getState().room?.code ?? null;
}

async function copyInvite(code: string): Promise<boolean> {
  return navigator.clipboard.writeText(shareText(code)).then(
    () => true,
    () => false,
  );
}

function refused(error: unknown, gone: Gone): TogetherDone {
  if (error instanceof ApiError && error.status === 404) return { state: gone };
  if (error instanceof ApiError && error.status === 409) return { state: 'room_full' };
  return { state: 'failed' };
}

async function entered(enter: () => Promise<void>, gone: Gone): Promise<TogetherDone> {
  try {
    await enter();
  } catch (error) {
    return refused(error, gone);
  }
  const code = roomCode();
  return code ? { state: 'ok', code } : { state: 'failed' };
}

async function joinOpen(host: string): Promise<TogetherDone> {
  const rooms = await roomsApi.open().catch(() => null);
  if (!rooms) return { state: 'failed' };
  const room = pickOpen(rooms, host);
  if (!room) return { state: 'no_open_room' };
  if (room.full) return { state: 'room_full' };
  return entered(() => joinOpenSession(room.hostId), 'no_open_room');
}

async function join(code: string, host: string): Promise<TogetherDone> {
  if (!code.trim()) return joinOpen(host);
  const clean = cleanCode(code);
  if (clean.length !== CODE_LENGTH) return { state: 'bad_code' };
  return entered(() => joinSession(clean), 'bad_code');
}

async function inRoom(ask: TogetherAsk, code: string): Promise<TogetherDone> {
  if (ask.act === 'leave') {
    await leaveSession();
    return { state: 'ok', code: null };
  }
  if (ask.act === 'visibility') {
    if (!isRoomHost(useTogetherStore.getState())) return { state: 'not_host' };
    return setRoomPublic(ask.open).then(
      (): TogetherDone => ({ state: 'ok', code }),
      (): TogetherDone => ({ state: 'failed' }),
    );
  }
  if (ask.act === 'invite') {
    return (await copyInvite(code)) ? { state: 'ok', code } : { state: 'failed' };
  }
  return { state: 'in_room' };
}

export async function together(ask: TogetherAsk): Promise<TogetherDone> {
  const current = roomCode();
  if (current) return inRoom(ask, current);
  if (ask.act === 'join') return join(ask.code, ask.host);
  if (ask.act !== 'start') return { state: 'no_room' };
  const made = await entered(() => hostSession(ask.open), 'no_open_room');
  if (made.state === 'ok' && made.code) await copyInvite(made.code);
  return made;
}

export async function openRooms(): Promise<OpenRoomShown[] | null> {
  const rooms = await roomsApi.open().catch(() => null);
  return rooms ? showRooms(rooms) : null;
}

export function roomNow(): RoomShown | null {
  const state = useTogetherStore.getState();
  if (!state.room) return null;
  return {
    role: isRoomHost(state) ? 'host' : 'guest',
    code: state.room.code,
    listeners: onlineGuests(state.room).length,
    ...(state.room.public ? { open: true } : {}),
  };
}
