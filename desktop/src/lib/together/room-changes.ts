import { isModerator, memberName, mutedUntil, roomTitle } from './room-rules.ts';
import type { RoomView } from './types.ts';

export type RoomChange =
  | { kind: 'handoff'; hostId: string; name: string; mine: boolean }
  | { kind: 'muted'; until: number }
  | { kind: 'unmuted' }
  | { kind: 'moderator'; on: boolean }
  | { kind: 'renamed'; title: string | null }
  | { kind: 'moved'; code: string };

export function roomChanges(
  previous: RoomView,
  next: RoomView,
  selfId: string | null,
  now: number,
): RoomChange[] {
  const changes: RoomChange[] = [];
  if (previous.code !== next.code) changes.push({ kind: 'moved', code: next.code });
  if (previous.hostId !== next.hostId) {
    changes.push({
      kind: 'handoff',
      hostId: next.hostId,
      name: memberName(next, next.hostId) ?? '',
      mine: next.hostId === selfId,
    });
  }
  const before = mutedUntil(previous, selfId, now);
  const after = mutedUntil(next, selfId, now);
  if (after !== null && after !== before) changes.push({ kind: 'muted', until: after });
  if (after === null && before !== null) changes.push({ kind: 'unmuted' });
  const wasModerator = isModerator(previous, selfId);
  const nowModerator = isModerator(next, selfId);
  if (wasModerator !== nowModerator && next.hostId !== selfId) {
    changes.push({ kind: 'moderator', on: nowModerator });
  }
  if (roomTitle(previous) !== roomTitle(next)) {
    changes.push({ kind: 'renamed', title: roomTitle(next) });
  }
  return changes;
}
