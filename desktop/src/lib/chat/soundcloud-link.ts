import { findSoundCloudLink, type SoundCloudLink } from '../soundcloudLink';

export const CHAT_EMBEDS_MAX = 3;

const CANDIDATE =
  /(?:^|[^\w.@-])((?:https?:\/\/)?(?:[a-z0-9-]+\.)?soundcloud\.com\/[^\s<>"']+|soundcloud:(?:tracks|playlists|users):\d+)/gi;
const TRAILING = /[).,!?»;:\]}…*]+$/;
const STAMP = /[#&?]t=([\dhms:]+)(?:$|[&#])/i;
const CLOCK = /^\d+(?::\d{1,2}){1,2}$/;
const UNITS = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;
const SECRET_PATH = /^s-[A-Za-z0-9_-]{1,62}$/;
const SECRET = /^[A-Za-z0-9_-]{1,64}$/;

export interface ChatLink {
  key: string;
  link: SoundCloudLink;
  atMs: number | null;
  secretToken: string | null;
}

export function findChatLinks(text: string, max = CHAT_EMBEDS_MAX): ChatLink[] {
  const found = new Map<string, ChatLink>();
  for (const match of text.matchAll(CANDIDATE)) {
    if (found.size >= max) break;
    const link = chatLink(match[1].replace(TRAILING, ''));
    if (link && !found.has(link.key)) found.set(link.key, link);
  }
  return [...found.values()];
}

function chatLink(raw: string): ChatLink | null {
  const link = findSoundCloudLink(raw);
  if (!link) return null;
  return {
    key: link.kind === 'urn' ? link.urn : link.url,
    link,
    atMs: timestampMs(raw),
    secretToken: link.kind === 'url' ? secretTokenOf(link.url) : null,
  };
}

export function timestampMs(raw: string): number | null {
  const value = STAMP.exec(raw)?.[1]?.toLowerCase();
  if (!value) return null;
  const seconds = CLOCK.test(value) ? clockSeconds(value) : unitSeconds(value);
  return seconds > 0 ? seconds * 1000 : null;
}

function clockSeconds(value: string): number {
  return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}

function unitSeconds(value: string): number {
  const match = UNITS.exec(value);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return Number(hours ?? 0) * 3600 + Number(minutes ?? 0) * 60 + Number(seconds ?? 0);
}

export function secretTokenOf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const query = parsed.searchParams.get('secret_token');
  if (query && isSecretToken(query)) return query;
  const last = parsed.pathname.split('/').filter(Boolean).pop() ?? '';
  return SECRET_PATH.test(last) ? last : null;
}

export function isSecretToken(value: string): boolean {
  return SECRET.test(value);
}
