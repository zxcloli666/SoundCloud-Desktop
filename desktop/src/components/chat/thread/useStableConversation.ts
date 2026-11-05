import { useRef } from 'react';
import type { ConversationSummary } from '../../../lib/chat/types';

const SHOWN = [
  'id',
  'kind',
  'title',
  'avatarUrl',
  'role',
  'state',
  'accepted',
  'memberCount',
  'mutedUntil',
  'notify',
  'ttlS',
  'roomCode',
  'historyLocked',
] as const;

function samePeer(a: ConversationSummary, b: ConversationSummary): boolean {
  return (
    a.peer?.id === b.peer?.id &&
    a.peer?.name === b.peer?.name &&
    a.peer?.avatarUrl === b.peer?.avatarUrl
  );
}

function sameShown(a: ConversationSummary, b: ConversationSummary): boolean {
  return SHOWN.every((key) => a[key] === b[key]) && samePeer(a, b);
}

export function useStableConversation(
  next: ConversationSummary | null,
): ConversationSummary | null {
  const kept = useRef(next);
  if (next === null || kept.current === null || !sameShown(kept.current, next)) {
    kept.current = next;
  }
  return kept.current;
}
