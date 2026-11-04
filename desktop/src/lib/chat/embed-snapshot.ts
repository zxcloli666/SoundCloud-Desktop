import { type Track, usePlayerStore } from '../../stores/player';
import { getCurrentTime } from '../audio';
import type { Playlist } from '../hooks';
import { type EntityKind, kindOf } from '../ids';
import { cleanPermalink } from '../permalink';
import { CODE_LENGTH, cleanCode } from '../together/errors';
import { getTrackDisplay } from '../track-display';
import { isSecretToken, secretTokenOf } from './soundcloud-link';
import type { Embed, EmbedTrack, RoomInvite } from './types';

const EMBED_BYTES_MAX = 3 * 1024;
const EMBED_TEXT_MAX = 120;
const EMBED_ROOM_TITLE_MAX = 48;
const EMBED_TRACKS_MAX = 5;
const URL_MAX = 512;
const DURATION_MAX_MS = 7 * 24 * 3_600_000;
const ACCESS = new Set(['playable', 'preview', 'blocked']);
const SOUNDCLOUD_HOSTS = new Set([
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'on.soundcloud.com',
]);
const ARTWORK_HOST = 'sndcdn.com';
const BIDI = new Set([
  0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);
const PRINTABLE_URL = /^[!-~]+$/;
const UNSAFE_URL = /[\\"<>`]/;
const HOST = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*$/;
const CODE_SEPARATORS = /[\s-]/g;
const ENTITY_OF: Record<Exclude<Embed['kind'], 'room_invite'>, EntityKind> = {
  track: 'tracks',
  playlist: 'playlists',
  user: 'users',
};
const encoder = new TextEncoder();

export interface EmbedUser {
  urn: string;
  username: string;
  full_name?: string | null;
  avatar_url?: string | null;
  permalink_url?: string | null;
}

export function trackEmbed(
  track: Track,
  atMs: number | null = null,
  secretToken: string | null = null,
): Embed | null {
  const urn = entityUrn(track.urn, 'tracks');
  if (!urn) return null;
  const display = getTrackDisplay(track);
  const durationMs = duration(track.full_duration || track.duration);
  return fit({
    kind: 'track',
    urn,
    permalink: permalink(track.permalink_url),
    secretToken: secretToken ?? secretOf(track.permalink_url),
    title: cleanText(display.title || track.title),
    artist: optionalText(display.artistLine || track.user?.username),
    artworkUrl: artwork(track.artwork_url),
    durationMs,
    access: track.access && ACCESS.has(track.access) ? track.access : null,
    atMs: startAt(atMs, durationMs),
    tracks: [],
    room: null,
  });
}

export function playlistEmbed(
  playlist: Playlist,
  secretToken: string | null = null,
  tracks: Track[] = playlist.tracks ?? [],
): Embed | null {
  const urn = entityUrn(playlist.urn, 'playlists');
  if (!urn) return null;
  const items = tracks.flatMap((track) => embedTrackOf(track) ?? []).slice(0, EMBED_TRACKS_MAX);
  return fit({
    kind: 'playlist',
    urn,
    permalink: permalink(playlist.permalink_url),
    secretToken: secretToken ?? secretOf(playlist.permalink_url),
    title: cleanText(playlist.title),
    artist: optionalText(playlist.user?.username),
    artworkUrl: artwork(playlist.artwork_url) ?? items[0]?.artworkUrl ?? null,
    durationMs: duration(playlist.duration),
    access: null,
    atMs: null,
    tracks: items,
    room: null,
  });
}

export function userEmbed(user: EmbedUser): Embed | null {
  const urn = entityUrn(user.urn, 'users');
  if (!urn) return null;
  const name = cleanText(user.username);
  const fullName = optionalText(user.full_name);
  return fit({
    kind: 'user',
    urn,
    permalink: permalink(user.permalink_url),
    secretToken: null,
    title: name,
    artist: fullName && fullName !== name ? fullName : null,
    artworkUrl: artwork(user.avatar_url),
    durationMs: null,
    access: null,
    atMs: null,
    tracks: [],
    room: null,
  });
}

export function roomInviteEmbed(code: string, title: string | null, host: string): Embed | null {
  const clean = roomCode(code);
  if (!clean) return null;
  const roomTitle = optionalText(title, EMBED_ROOM_TITLE_MAX);
  return fit({
    kind: 'room_invite',
    urn: '',
    permalink: '',
    secretToken: null,
    title: roomTitle ?? '',
    artist: null,
    artworkUrl: null,
    durationMs: null,
    access: null,
    atMs: null,
    tracks: [],
    room: { code: clean, title: roomTitle, host: cleanText(host) },
  });
}

export function nowPlayingEmbed(): Embed | null {
  const track = usePlayerStore.getState().currentTrack;
  if (!track) return null;
  const seconds = Math.floor(getCurrentTime());
  return trackEmbed(track, seconds > 0 ? seconds * 1000 : null);
}

export function receivedEmbed(embed: Embed): Embed | null {
  if (embed.kind === 'room_invite') return receivedInvite(embed.room);
  const urn = entityUrn(embed.urn, ENTITY_OF[embed.kind]);
  if (!urn) return null;
  const durationMs = duration(embed.durationMs);
  return fit({
    kind: embed.kind,
    urn,
    permalink: permalink(embed.permalink),
    secretToken: embed.secretToken && isSecretToken(embed.secretToken) ? embed.secretToken : null,
    title: cleanText(embed.title),
    artist: optionalText(embed.artist),
    artworkUrl: artwork(embed.artworkUrl),
    durationMs,
    access: embed.access && ACCESS.has(embed.access) ? embed.access : null,
    atMs: embed.kind === 'track' ? startAt(embed.atMs, durationMs) : null,
    tracks:
      embed.kind === 'playlist'
        ? embed.tracks.flatMap((track) => receivedTrack(track) ?? []).slice(0, EMBED_TRACKS_MAX)
        : [],
    room: null,
  });
}

function receivedInvite(room: RoomInvite | null): Embed | null {
  return room ? roomInviteEmbed(room.code, room.title, room.host) : null;
}

function receivedTrack(track: EmbedTrack): EmbedTrack | null {
  const urn = entityUrn(track.urn, 'tracks');
  const title = cleanText(track.title);
  if (!urn || !title) return null;
  return {
    urn,
    title,
    artist: cleanText(track.artist),
    durationMs: duration(track.durationMs) ?? 0,
    artworkUrl: artwork(track.artworkUrl),
  };
}

function roomCode(raw: string): string | null {
  const code = raw.replace(CODE_SEPARATORS, '').toUpperCase();
  return code.length === CODE_LENGTH && cleanCode(code) === code ? code : null;
}

function embedTrackOf(track: Track): EmbedTrack | null {
  const urn = entityUrn(track.urn, 'tracks');
  if (!urn || !track.title) return null;
  const display = getTrackDisplay(track);
  const title = cleanText(display.title || track.title);
  if (!title) return null;
  return {
    urn,
    title,
    artist: cleanText(display.artistLine || track.user?.username),
    durationMs: duration(track.duration) ?? 0,
    artworkUrl: artwork(track.artwork_url),
  };
}

function secretOf(url: string | undefined): string | null {
  return url ? secretTokenOf(url) : null;
}

function entityUrn(urn: string | null | undefined, kind: EntityKind | undefined): string | null {
  return urn && kind && kindOf(urn) === kind ? urn : null;
}

function cleanText(raw: string | null | undefined, max = EMBED_TEXT_MAX): string {
  return Array.from((raw ?? '').trim())
    .filter(keepChar)
    .slice(0, max)
    .join('')
    .trim();
}

function optionalText(raw: string | null | undefined, max = EMBED_TEXT_MAX): string | null {
  return cleanText(raw, max) || null;
}

function keepChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code >= 0x20 && !(code >= 0x7f && code <= 0x9f) && !BIDI.has(code);
}

function duration(ms: number | null | undefined): number | null {
  if (!ms || !Number.isFinite(ms)) return null;
  const rounded = Math.round(ms);
  return rounded >= 1 && rounded <= DURATION_MAX_MS ? rounded : null;
}

function startAt(atMs: number | null, durationMs: number | null): number | null {
  if (atMs === null || atMs <= 0) return null;
  const at = Math.floor(atMs / 1000) * 1000;
  return at < (durationMs ?? DURATION_MAX_MS) ? at : null;
}

function httpsHost(url: string): string | null {
  if (url.length > URL_MAX || !PRINTABLE_URL.test(url) || UNSAFE_URL.test(url)) return null;
  if (!url.startsWith('https://')) return null;
  const rest = url.slice('https://'.length);
  const end = rest.search(/[/?#]/);
  const host = end < 0 ? rest : rest.slice(0, end);
  return HOST.test(host) ? host : null;
}

function artwork(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const host = httpsHost(trimmed);
  const trusted = host === ARTWORK_HOST || !!host?.endsWith(`.${ARTWORK_HOST}`);
  return trusted ? trimmed : null;
}

function permalink(url: string | null | undefined): string {
  if (!url) return '';
  const clean = cleanPermalink(url.trim());
  const host = httpsHost(clean);
  return host && SOUNDCLOUD_HOSTS.has(host) ? clean : '';
}

function fit(embed: Embed): Embed | null {
  if (!embed.title && embed.kind !== 'room_invite') return null;
  const tracks = [...embed.tracks];
  for (;;) {
    const candidate = { ...embed, tracks: [...tracks] };
    if (encoder.encode(JSON.stringify(candidate)).length <= EMBED_BYTES_MAX) return candidate;
    if (tracks.pop() === undefined) return null;
  }
}
