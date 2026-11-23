import type { OpenRoom } from '../../together/types';
import type { OpenRoomShown } from './ports';

const ROOMS_SHOWN = 8;

function fold(text: string): string {
  return text.trim().toLocaleLowerCase();
}

export function pickOpen(rooms: OpenRoom[], host: string): OpenRoom | null {
  const wanted = fold(host);
  if (!wanted) {
    const free = rooms.filter((room) => !room.full);
    return free.sort((a, b) => b.listeners - a.listeners)[0] ?? null;
  }
  const named = (room: OpenRoom) => fold(room.hostName);
  return (
    rooms.find((room) => named(room) === wanted) ??
    rooms.find((room) => named(room).includes(wanted) || wanted.includes(named(room))) ??
    null
  );
}

export function showRooms(rooms: OpenRoom[]): OpenRoomShown[] {
  return [...rooms]
    .sort((a, b) => Number(a.full) - Number(b.full) || b.listeners - a.listeners)
    .slice(0, ROOMS_SHOWN)
    .map((room) => ({
      host: room.hostName,
      track: room.track ? [room.track.title, room.track.artist].filter(Boolean).join(' - ') : null,
      listeners: room.listeners,
      capacity: room.capacity,
      full: room.full,
    }));
}
