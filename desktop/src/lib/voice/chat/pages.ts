export const PAGES = [
  'home',
  'search',
  'library',
  'likes',
  'playlists',
  'following',
  'history',
  'stats',
  'dislikes',
  'superlikes',
  'discover',
  'settings',
  'chats',
  'current_track',
  'current_artist',
  'current_album',
] as const;
export type Page = (typeof PAGES)[number];

export const SETTINGS_SECTIONS = [
  'general',
  'appearance',
  'audio',
  'voice',
  'network',
  'integrations',
  'chats',
  'storage',
  'account',
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export interface CurrentLinks {
  track: string | null;
  artist: string | null;
  album: string | null;
}

export interface PageTarget {
  to: string;
  state?: { category: SettingsSection };
}

const STATIC: Partial<Record<Page, string>> = {
  home: '/home',
  search: '/search',
  library: '/library',
  likes: '/library/likes',
  playlists: '/library/playlists',
  following: '/library/following',
  history: '/library/history',
  stats: '/library/stats',
  dislikes: '/library/dislikes',
  superlikes: '/library/superlikes',
  discover: '/discover',
  chats: '/chats',
};

export function pageTarget(
  page: Page,
  section: SettingsSection | null,
  links: CurrentLinks,
): PageTarget | null {
  if (page === 'settings')
    return { to: '/settings', state: section ? { category: section } : undefined };
  if (page === 'current_track') return links.track ? { to: links.track } : null;
  if (page === 'current_artist') return links.artist ? { to: links.artist } : null;
  if (page === 'current_album') return links.album ? { to: links.album } : null;
  const to = STATIC[page];
  return to ? { to } : null;
}

const NAMED = new Map(Object.entries(STATIC).map(([page, to]) => [to, page]));

const BY_SECTION: Record<string, string> = {
  library: 'library',
  settings: 'settings',
  chats: 'chats',
  track: 'track',
  playlist: 'playlist',
  album: 'album',
  artist: 'artist',
  user: 'artist',
};

export function pageName(path: string): string {
  const clean = path.replace(/\/+$/, '');
  return NAMED.get(clean) ?? BY_SECTION[clean.split('/')[1] ?? ''] ?? 'other';
}
