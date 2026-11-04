import type { Member } from '../chat/types.ts';
import type { RoomMember, RoomView } from './types.ts';

export const MAX_MODERATORS = 3;
export const MUTE_MINUTES = [5, 15, 60] as const;
export const SLOW_MODE_SECONDS = [0, 3, 10, 30, 60] as const;
export const TITLE_MAX = 48;
export const NEW_MEMBER_MS = 60_000;

const LINK = /https?:\/\/\S|scd:\/\/\S|(^|[^\w.@])www\.\S/i;

export type RoomExit = 'ended' | 'kicked' | 'evicted';

export type RoomLinkBlock = 'off' | 'new' | null;

export interface MemberActions {
  kick: boolean;
  mute: boolean;
  ban: boolean;
  moderator: 'add' | 'remove' | null;
  moderatorsFull: boolean;
}

export function isHost(view: RoomView, userId: string | null): boolean {
  return !!userId && view.hostId === userId;
}

export function isModerator(view: RoomView, userId: string | null): boolean {
  return !!userId && (view.moderators ?? []).includes(userId);
}

export function canModerate(view: RoomView, userId: string | null): boolean {
  return isHost(view, userId) || isModerator(view, userId);
}

export function hasModeration(view: RoomView): boolean {
  return Array.isArray(view.moderators);
}

export function mutedUntil(view: RoomView, userId: string | null, now: number): number | null {
  if (!userId) return null;
  const mute = view.muted?.find((entry) => entry.userId === userId && entry.untilMs > now);
  return mute?.untilMs ?? null;
}

export function moderatorsMax(view: RoomView): number {
  return view.perks?.modsMax ?? MAX_MODERATORS;
}

export function memberActions(
  view: RoomView,
  actor: string | null,
  target: string,
): MemberActions | null {
  if (!actor || actor === target || !hasModeration(view)) return null;
  if (!canModerate(view, actor) || isHost(view, target)) return null;
  if (!view.members.some((member) => member.userId === target)) return null;
  const host = isHost(view, actor);
  const targetIsModerator = isModerator(view, target);
  if (!host && targetIsModerator) return null;
  return {
    kick: true,
    mute: true,
    ban: host,
    moderator: host ? (targetIsModerator ? 'remove' : 'add') : null,
    moderatorsFull: !targetIsModerator && (view.moderators?.length ?? 0) >= moderatorsMax(view),
  };
}

function rank(view: RoomView, member: RoomMember): number {
  if (member.userId === view.hostId) return 0;
  if (isModerator(view, member.userId)) return 1;
  return view.online.includes(member.userId) ? 2 : 3;
}

export function orderedMembers(view: RoomView): RoomMember[] {
  return [...view.members].sort((a, b) => rank(view, a) - rank(view, b) || a.joinedAt - b.joinedAt);
}

export function nextHost(view: RoomView, leaving: string): RoomMember | null {
  let next: RoomMember | null = null;
  for (const member of view.members) {
    if (member.userId === leaving || !view.online.includes(member.userId)) continue;
    const earlier =
      !next ||
      member.joinedAt < next.joinedAt ||
      (member.joinedAt === next.joinedAt && member.userId < next.userId);
    if (earlier) next = member;
  }
  return next;
}

const HIDDEN_RANGES: [number, number][] = [
  [0x00, 0x1f],
  [0x7f, 0x9f],
  [0x200b, 0x200f],
  [0x202a, 0x202e],
  [0x2060, 0x2069],
  [0xfeff, 0xfeff],
];

function visible(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return !HIDDEN_RANGES.some(([from, to]) => code >= from && code <= to);
}

function blank(char: string): boolean {
  return char === '\u0085' || (char !== '\ufeff' && /\s/.test(char));
}

export function cleanTitle(raw: string): string {
  const chars = Array.from(raw).map((char) => (blank(char) ? ' ' : char));
  const words = chars.filter(visible).join('').split(' ').filter(Boolean);
  return Array.from(words.join(' ')).slice(0, TITLE_MAX).join('').trimEnd();
}

export function roomTitle(view: RoomView): string | null {
  const title = view.title?.trim();
  return title ? title : null;
}

export function hasLink(text: string): boolean {
  return LINK.test(text);
}

export function linksOff(view: RoomView, userId: string | null): boolean {
  return view.links === false && !canModerate(view, userId);
}

export function linksOpenAt(view: RoomView, userId: string | null): number {
  if (!view.public || canModerate(view, userId)) return 0;
  const member = view.members.find((entry) => entry.userId === userId);
  return member ? member.joinedAt + NEW_MEMBER_MS : 0;
}

export function linkBlock(view: RoomView, userId: string | null, now: number): RoomLinkBlock {
  if (linksOff(view, userId)) return 'off';
  return now < linksOpenAt(view, userId) ? 'new' : null;
}

export function linkBlockKey(block: Exclude<RoomLinkBlock, null>): string {
  return block === 'off' ? 'chat.room.links.off' : 'chat.room.links.new';
}

export function memberName(view: RoomView, userId: string | null): string | null {
  if (!userId) return null;
  return view.members.find((member) => member.userId === userId)?.name ?? null;
}

export function exitOf(status: number, code: string | null, wasLive: boolean): RoomExit | null {
  if (status !== 404) return null;
  if (code === 'room_not_member') return wasLive ? 'kicked' : 'evicted';
  return 'ended';
}

const EXIT_TOASTS: Record<RoomExit, string> = {
  ended: 'chat.room.toast.ended',
  kicked: 'chat.room.toast.kicked',
  evicted: 'together.toast.evicted',
};

export function exitToast(exit: RoomExit, withChat: boolean, wasGuest: boolean): string | null {
  if (exit !== 'ended' || withChat) return EXIT_TOASTS[exit];
  return wasGuest ? 'together.toast.ended' : null;
}

export function chatMembers(view: RoomView): Member[] {
  return view.members.map((member) => ({
    user: { id: member.userId, name: member.name, avatarUrl: member.avatarUrl, permalink: null },
    role: isHost(view, member.userId)
      ? 'owner'
      : isModerator(view, member.userId)
        ? 'admin'
        : 'member',
    state: 'active',
    accepted: true,
    joinedSeq: 0,
    invitedBy: null,
  }));
}
