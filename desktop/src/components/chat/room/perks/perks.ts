import { proxiedAssetUrl } from '../../../../lib/asset-url';
import type { RoomCover } from '../../../../lib/chat/media-types';
import { MAX_MODERATORS } from '../../../../lib/together/room-rules';
import { ROOM_CAPACITY, type RoomPerks, type RoomView } from '../../../../lib/together/types';

export const STAR_CAPACITY = 25;
export const STAR_MODERATORS = 8;
export const COVER_URL_MAX = 512;

export const COVER_ACCENTS = [
  '#ff6a3d',
  '#f2a516',
  '#5fbf3a',
  '#14b8a6',
  '#3b95f5',
  '#6d68f2',
  '#a855f7',
  '#ec4f9c',
] as const;

const LIGHT_ACCENTS: ReadonlySet<number> = new Set([1, 2, 3]);

const FREE_PERKS: RoomPerks = { starHost: false, capacity: ROOM_CAPACITY, modsMax: MAX_MODERATORS };
const SNDCDN = /^https:\/\/([a-z0-9-]+\.)*sndcdn\.com\//i;
const SIZE_SUFFIX = /-(large|t\d+x\d+|original|crop|small|tiny|badge|mini|t67x67)(\.\w+)$/;

export function roomPerks(room: Pick<RoomView, 'perks'>): RoomPerks {
  return room.perks ?? FREE_PERKS;
}

export function accentColor(accent: number | null | undefined): string {
  const index = accent ?? 0;
  return COVER_ACCENTS[index >= 0 && index < COVER_ACCENTS.length ? index : 0];
}

export function accentInk(accent: number | null | undefined): string {
  return LIGHT_ACCENTS.has(accent ?? 0) ? '#17141d' : '#ffffff';
}

export function accentRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function isCoverUrl(url: string | null | undefined): url is string {
  return !!url && url.length <= COVER_URL_MAX && SNDCDN.test(url);
}

export function sizedArt(url: string, size: string): string {
  return url.replace(SIZE_SUFFIX, `-${size}$2`);
}

export function coverSrc(url: string | null | undefined, size = 't200x200'): string | null {
  if (!url) return null;
  return proxiedAssetUrl(sizedArt(url, size));
}

export function validCover(cover: RoomCover | null | undefined): RoomCover | null {
  return cover && isCoverUrl(cover.url) ? cover : null;
}

export function activeCover(room: Pick<RoomView, 'perks' | 'cover'>): RoomCover | null {
  return roomPerks(room).starHost ? validCover(room.cover) : null;
}

export interface RoomArt {
  src: string | null;
  accent: string | null;
}

export function roomArt(
  cover: RoomCover | null | undefined,
  trackArt: string | null | undefined,
  size = 't200x200',
): RoomArt {
  const custom = validCover(cover);
  if (custom) return { src: coverSrc(custom.url, size), accent: accentColor(custom.accent) };
  return { src: coverSrc(trackArt, size), accent: null };
}

export type SeatsState = 'open' | 'full' | 'over';

export function seatsState(members: number, capacity: number): SeatsState {
  if (members > capacity) return 'over';
  return members >= capacity ? 'full' : 'open';
}
