import { type EntityKind, isEntityKind, kindOf, toUrn } from './ids';

export type SoundCloudLink = { kind: 'urn'; urn: string } | { kind: 'url'; url: string };

const BARE_URN = /^soundcloud:(tracks|playlists|users):(\d+)$/i;
const LINK = /(?:^|[^\w.@-])((?:https?:\/\/)?(?:[a-z0-9-]+\.)?soundcloud\.com\/[^\s<>"']+)/gi;
const TRAILING = /[).,!?»;:\]}…*]+$/;
const API_HOSTS = new Set(['api.soundcloud.com', 'api-v2.soundcloud.com']);
const KEPT_PARAMS = new Set(['secret_token']);
const ROUTES: Record<EntityKind, string> = {
  tracks: 'track',
  playlists: 'playlist',
  users: 'user',
};
const NON_ENTITY_PATHS = new Set([
  'discover',
  'search',
  'you',
  'stream',
  'upload',
  'charts',
  'pages',
  'settings',
  'notifications',
  'messages',
]);

export function findSoundCloudLink(text: string): SoundCloudLink | null {
  const trimmed = text.trim();
  const bare = BARE_URN.exec(trimmed);
  if (bare) return urnLink(bare[1].toLowerCase(), bare[2]);
  for (const match of trimmed.matchAll(LINK)) {
    const link = parseLink(match[1].split('](')[0].replace(TRAILING, ''));
    if (link) return link;
  }
  return null;
}

function parseLink(raw: string): SoundCloudLink | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  if (host === 'w.soundcloud.com') {
    const inner = url.searchParams.get('url');
    return inner ? findSoundCloudLink(inner) : null;
  }
  if (API_HOSTS.has(host)) {
    const [kind, id] = segments;
    return urnLink(kind, id);
  }
  if (segments.length === 0 || NON_ENTITY_PATHS.has(segments[0].toLowerCase())) return null;
  for (const key of [...url.searchParams.keys()]) {
    if (!KEPT_PARAMS.has(key)) url.searchParams.delete(key);
  }
  url.protocol = 'https:';
  url.hash = '';
  return { kind: 'url', url: url.toString() };
}

function urnLink(kind: string, id: string | undefined): SoundCloudLink | null {
  const urn = isEntityKind(kind) ? toUrn(kind, id) : null;
  return urn ? { kind: 'urn', urn } : null;
}

export function linkRoute(urn: string): string | null {
  const kind = kindOf(urn);
  return kind ? `/${ROUTES[kind]}/${encodeURIComponent(urn)}` : null;
}
