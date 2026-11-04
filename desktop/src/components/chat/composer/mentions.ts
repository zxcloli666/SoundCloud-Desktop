import type { Member, UserId, UserRef } from '../../../lib/chat/types';

const QUERY = /(?:^|\s)@([\p{L}\p{N}_.-]{0,32})$/u;
const LIMIT = 6;

export interface MentionQuery {
  query: string;
  start: number;
}

export function mentionQuery(text: string, caret: number): MentionQuery | null {
  const match = QUERY.exec(text.slice(0, caret));
  if (!match) return null;
  return { query: match[1], start: caret - match[1].length - 1 };
}

export function mentionCandidates(members: Member[], query: string, me: UserId | null): UserRef[] {
  const needle = query.toLocaleLowerCase();
  const people = members
    .filter((member) => member.state === 'active' && member.user.id !== me)
    .map((member) => member.user);
  const starts = people.filter((user) => user.name.toLocaleLowerCase().startsWith(needle));
  const contains = people.filter(
    (user) => !starts.includes(user) && user.name.toLocaleLowerCase().includes(needle),
  );
  return [...starts, ...contains].slice(0, LIMIT);
}
