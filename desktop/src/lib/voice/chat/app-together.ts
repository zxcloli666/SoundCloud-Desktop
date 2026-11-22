import { isRoomHost, useTogetherStore } from '../../../stores/together';
import { CODE_LENGTH, cleanCode } from '../../together/errors';
import { onlineGuests } from '../../together/link';
import { hostSession, joinSession, leaveSession, shareText } from '../../together/session';
import type { RoomShown } from './context';
import type { TogetherAct, TogetherDone } from './ports';

function roomCode(): string | null {
  return useTogetherStore.getState().room?.code ?? null;
}

async function copyInvite(code: string): Promise<boolean> {
  return navigator.clipboard.writeText(shareText(code)).then(
    () => true,
    () => false,
  );
}

async function entered(enter: () => Promise<void>): Promise<TogetherDone> {
  try {
    await enter();
  } catch {
    return { state: 'failed' };
  }
  const code = roomCode();
  return code ? { state: 'ok', code } : { state: 'failed' };
}

export async function together(
  act: TogetherAct,
  code: string,
  open: boolean,
): Promise<TogetherDone> {
  const current = roomCode();
  if (act === 'leave' || act === 'invite') {
    if (!current) return { state: 'no_room' };
    if (act === 'leave') await leaveSession();
    else if (!(await copyInvite(current))) return { state: 'failed' };
    return { state: 'ok', code: act === 'leave' ? null : current };
  }
  if (current) return { state: 'in_room' };
  if (act === 'join') {
    const clean = cleanCode(code);
    if (clean.length !== CODE_LENGTH) return { state: 'bad_code' };
    return entered(() => joinSession(clean));
  }
  const made = await entered(() => hostSession(open));
  if (made.state === 'ok' && made.code) await copyInvite(made.code);
  return made;
}

export function roomNow(): RoomShown | null {
  const state = useTogetherStore.getState();
  if (!state.room) return null;
  return {
    role: isRoomHost(state) ? 'host' : 'guest',
    code: state.room.code,
    listeners: onlineGuests(state.room).length,
  };
}
