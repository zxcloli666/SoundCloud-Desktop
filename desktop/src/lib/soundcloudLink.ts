export type SoundCloudLink = { kind: 'urn'; urn: string } | { kind: 'url'; url: string };

const BARE_URN = /^soundcloud:(tracks|playlists|users):(\d+)$/i;
const LINK =
  /(?:^|[^\w.@-])((?:https?:\/\/)?(?:[a-z0-9-]+\.)?(?:soundcloud\.com|snd\.sc)\/[^\s<>"']+)/i;
const TRAILING = /[).,!?»]+$/;
const API_HOSTS = new Set(['api.soundcloud.com', 'api-v2.soundcloud.com']);
const ENTITY_KINDS = new Set(['tracks', 'playlists', 'users']);
const TRACKING_PARAM = /^(si|ref|utm_.*)$/i;
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
  const urn = BARE_URN.exec(trimmed);
  if (urn) return { kind: 'urn', urn: `soundcloud:${urn[1].toLowerCase()}:${urn[2]}` };
  const match = LINK.exec(trimmed);
  return match ? parseLink(match[1].replace(TRAILING, '')) : null;
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
    return ENTITY_KINDS.has(kind) && /^\d+$/.test(id ?? '')
      ? { kind: 'urn', urn: `soundcloud:${kind}:${id}` }
      : null;
  }
  if (segments.length === 0 || NON_ENTITY_PATHS.has(segments[0].toLowerCase())) return null;
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.protocol = 'https:';
  url.hash = '';
  return { kind: 'url', url: url.toString() };
}

export function linkRoute(urn: string): string | null {
  const [, kind] = urn.split(':');
  const route =
    kind === 'tracks'
      ? 'track'
      : kind === 'playlists'
        ? 'playlist'
        : kind === 'users'
          ? 'user'
          : null;
  return route ? `/${route}/${encodeURIComponent(urn)}` : null;
}
