import { selectChatEnabled, useChatStore } from '../stores/chat';

export type LayoutScope = 'sidebar' | 'library' | 'home';

export interface LayoutEntry {
  id: string;
  hidden: boolean;
}

export type LayoutState = Record<LayoutScope, LayoutEntry[]>;

export const LAYOUT_IDS = {
  sidebar: ['home', 'search', 'discover', 'library', 'chats', 'star', 'offline'],
  library: [
    'fresh',
    'continue',
    'stats',
    'playlists',
    'likedPlaylists',
    'likedAlbums',
    'local',
    'artists',
    'superlikes',
    'likes',
    'dislikes',
  ],
  home: ['river', 'releases', 'superlikes', 'likes', 'recommended'],
} as const satisfies Record<LayoutScope, readonly string[]>;

export type LayoutId<S extends LayoutScope> = (typeof LAYOUT_IDS)[S][number];

export const RIVER_SECTIONS = [
  'wave',
  'top_artists',
  'fresh_drops',
  'same_vibe',
  'adjacent',
  'deep_cuts',
  'discover',
] as const;

export type RiverSectionId = (typeof RIVER_SECTIONS)[number];

export const LOCKED_VISIBLE: ReadonlySet<string> = new Set(['sidebar:star']);

export const EMPTY_LAYOUT: LayoutState = { sidebar: [], library: [], home: [] };

const NONE_GATED: ReadonlySet<string> = new Set();
const CHATS_GATED: ReadonlySet<string> = new Set(['chats']);

export function gatedIds(chatEnabled: boolean): ReadonlySet<string> {
  return chatEnabled ? NONE_GATED : CHATS_GATED;
}

function currentGated(): ReadonlySet<string> {
  return gatedIds(selectChatEnabled(useChatStore.getState()));
}

export interface ResolvedEntry<T extends string> {
  id: T;
  hidden: boolean;
}

export function resolveLayout<T extends string>(
  saved: readonly LayoutEntry[] | undefined,
  ids: readonly T[],
  gated: ReadonlySet<string> = currentGated(),
): ResolvedEntry<T>[] {
  const known = new Set<string>(ids.filter((id) => !gated.has(id)));
  const seen = new Set<string>();
  const out: ResolvedEntry<T>[] = [];
  for (const entry of saved ?? []) {
    if (!known.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push({ id: entry.id as T, hidden: !!entry.hidden });
  }
  ids.forEach((id, index) => {
    if (!known.has(id) || seen.has(id)) return;
    let at = 0;
    for (let prev = index - 1; prev >= 0; prev--) {
      const found = out.findIndex((entry) => entry.id === ids[prev]);
      if (found >= 0) {
        at = found + 1;
        break;
      }
    }
    out.splice(at, 0, { id, hidden: false });
    seen.add(id);
  });
  return out;
}

export function moveEntry<T extends { id: string }>(list: readonly T[], from: string, to: string) {
  const fromIndex = list.findIndex((e) => e.id === from);
  const toIndex = list.findIndex((e) => e.id === to);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return [...list];
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function isDefaultLayout(entries: readonly LayoutEntry[], ids: readonly string[]) {
  const gated = currentGated();
  const visible = ids.filter((id) => !gated.has(id));
  return entries.every((e, i) => e.id === visible[i] && !e.hidden);
}
