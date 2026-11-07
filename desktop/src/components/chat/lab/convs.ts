import type { ConversationSummary, Message } from '../../../lib/chat/types';
import { ME_ID, person, personName } from './people';

export const NOW = Date.now();
const MIN = 60_000;

export const CONV = {
  dm: 'c-dm',
  group: 'c-group',
  self: 'c-self',
  dm2: 'c-dm-danil',
  dm3: 'c-dm-lena',
  room: 'c-room',
  public: 'c-public',
} as const;

export const ROOM_CODE = 'LAB42';
export const PUBLIC_ONLINE = 128;
export const OWNER_ID = 'u-owner';
export const GROUP_AVATAR = 'avatar-group';

function base(id: string): ConversationSummary {
  return {
    id,
    kind: 'direct',
    title: null,
    avatarUrl: null,
    avatarMediaId: null,
    peer: null,
    role: 'member',
    state: 'active',
    accepted: true,
    memberCount: 2,
    lastSeq: 0,
    lastAt: NOW,
    lastReadSeq: 0,
    unread: 0,
    mentions: 0,
    preview: null,
    mutedUntil: null,
    notify: 'all',
    pinnedAt: null,
    archived: false,
    ttlS: null,
    roomCode: null,
    historyLocked: false,
    hasDraft: false,
    pinged: false,
    slowModeS: 0,
  };
}

function lastOf(messages: Message[], conv: ConversationSummary): ConversationSummary {
  const last = messages[messages.length - 1];
  if (!last || last.body.type !== 'text') return conv;
  return {
    ...conv,
    lastSeq: last.seq ?? 0,
    lastAt: last.ts,
    preview: {
      seq: last.seq ?? 0,
      sender: last.sender,
      kind: last.attachments.length > 0 ? 'image' : 'text',
      text: last.body.text,
      ts: last.ts,
      expiresAt: null,
    },
  };
}

export function labConversations(threads: Record<string, Message[]>): ConversationSummary[] {
  const dm: ConversationSummary = {
    ...base(CONV.dm),
    peer: person('u-mira'),
    pinnedAt: NOW - 5 * MIN,
    unread: 2,
    lastReadSeq: 5,
  };
  const group: ConversationSummary = {
    ...base(CONV.group),
    kind: 'group',
    title: 'Выходные: сборка',
    avatarMediaId: GROUP_AVATAR,
    role: 'owner',
    memberCount: 5,
    unread: 1,
    lastReadSeq: 4,
    mentions: 1,
  };
  const self: ConversationSummary = { ...base(CONV.self), kind: 'self', peer: person(ME_ID) };
  const danil: ConversationSummary = { ...base(CONV.dm2), peer: person('u-danil') };
  const lena: ConversationSummary = {
    ...base(CONV.dm3),
    peer: person('u-lena'),
    mutedUntil: NOW + 8 * 3_600_000,
  };
  const room: ConversationSummary = {
    ...base(CONV.room),
    kind: 'room',
    title: 'Ночной эфир',
    roomCode: ROOM_CODE,
    memberCount: 4,
  };
  const open: ConversationSummary = {
    ...base(CONV.public),
    kind: 'public',
    notify: 'mentions',
    pinnedAt: NOW - 400 * 24 * 3_600_000,
    memberCount: PUBLIC_ONLINE,
    slowModeS: 5,
  };
  return [open, dm, group, self, danil, lena, room].map((conv) =>
    lastOf(threads[conv.id] ?? [], conv),
  );
}

export function publicStaff(moderators: string[] = ['u-mira']) {
  return [OWNER_ID, ...moderators].map((id, index) => ({
    user: person(id),
    role: index === 0 ? ('owner' as const) : ('admin' as const),
    state: 'active' as const,
    accepted: true,
    joinedSeq: 0,
    invitedBy: null,
  }));
}

export function groupMembers() {
  return ['u-me', 'u-mira', 'u-danil', 'u-sasha', 'u-kai'].map((id, index) => ({
    user: person(id),
    role: index === 0 ? ('owner' as const) : ('member' as const),
    state: 'active' as const,
    accepted: true,
    joinedSeq: 0,
    invitedBy: null,
  }));
}

export { personName };
