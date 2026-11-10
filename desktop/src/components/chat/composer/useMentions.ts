import { useState } from 'react';
import type { Member, UserId, UserRef } from '../../../lib/chat/types';
import { type MentionQuery, mentionCandidates, mentionQuery } from './mentions';

export interface Mentions {
  query: MentionQuery | null;
  candidates: UserRef[];
  active: number;
  move: (step: number) => void;
  close: () => void;
  reset: () => void;
}

export function useMentions(
  text: string,
  caret: number,
  members: Member[],
  me: UserId | null,
  enabled: boolean,
): Mentions {
  const [index, setIndex] = useState(0);
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const query = enabled ? mentionQuery(text, caret) : null;
  const open = query !== null && query.start !== closedAt;
  const candidates = open ? mentionCandidates(members, query.query, me) : [];
  const active = Math.min(index, Math.max(0, candidates.length - 1));

  return {
    query,
    candidates,
    active,
    move: (step) =>
      setIndex((at) => (at + step + candidates.length) % Math.max(1, candidates.length)),
    close: () => setClosedAt(query?.start ?? null),
    reset: () => setIndex(0),
  };
}
