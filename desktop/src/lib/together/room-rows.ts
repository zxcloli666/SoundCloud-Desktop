import type { ConversationKind, SystemEvent } from '../chat/types';

export type RoomRowKind = 'track' | 'suggest' | 'moderator';

export function roomRowKind(event: SystemEvent): RoomRowKind | null {
  if (event.kind === 'track' && event.track) return 'track';
  if (event.kind === 'suggest' && event.track) return 'suggest';
  if (event.kind === 'moderator' && event.target) return 'moderator';
  return null;
}

export function canForwardFrom(kind: ConversationKind): boolean {
  return kind !== 'room';
}
