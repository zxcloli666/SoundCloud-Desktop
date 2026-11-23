import { selectChatInNav, useChatStore } from '../stores/chat';
import {
  isDefaultPlacement,
  isSurface,
  PLAYER_HIDDEN,
  PLAYER_IDS,
  type Placed,
  type PlayerButtonId,
  placeZones,
  type Surface,
  type Zone,
} from './player-zones';

export type LayoutScope = 'sidebar' | 'quick' | 'library' | 'home' | 'player' | 'deck';

export interface LayoutEntry {
  id: string;
  hidden: boolean;
  zone?: Zone;
}

export type LayoutState = Record<LayoutScope, LayoutEntry[]>;

export const LAYOUT_IDS = {
  sidebar: ['home', 'moments', 'search', 'discover', 'library', 'chats', 'offline'],
  quick: ['history', 'likes', 'superlikes', 'playlists', 'following', 'stats', 'dislikes'],
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
  home: ['river', 'shelf', 'releases', 'superlikes', 'likes', 'recommended'],
  player: PLAYER_IDS,
  deck: PLAYER_IDS,
} as const satisfies Record<LayoutScope, readonly string[]>;

export type LayoutId<S extends LayoutScope> = (typeof LAYOUT_IDS)[S][number];

export const RIVER_SECTIONS = [
  'wave',
  'moments',
  'top_artists',
  'fresh_drops',
  'same_vibe',
  'adjacent',
  'deep_cuts',
  'discover',
] as const;

export type RiverSectionId = (typeof RIVER_SECTIONS)[number];

export type RiverHiddenEntry = RiverSectionId | 'custom';

export function resolveRiverHidden(
  saved: readonly RiverHiddenEntry[],
): ReadonlySet<RiverSectionId> {
  if (saved.length === 0) return new Set(RIVER_SECTIONS);
  return new Set(saved.filter((id): id is RiverSectionId => id !== 'custom'));
}

export function toggleRiverSection(
  saved: readonly RiverHiddenEntry[],
  id: RiverSectionId,
): RiverHiddenEntry[] {
  const hidden = new Set(resolveRiverHidden(saved));
  if (hidden.has(id)) hidden.delete(id);
  else hidden.add(id);
  return [...hidden, 'custom'];
}

export const LOCKED_VISIBLE: ReadonlySet<string> = new Set();

const NO_IDS: ReadonlySet<string> = new Set();

export const DEFAULT_HIDDEN: Record<LayoutScope, ReadonlySet<string>> = {
  sidebar: new Set(['search', 'discover', 'offline']),
  quick: new Set(['playlists', 'following', 'stats', 'dislikes']),
  library: NO_IDS,
  home: new Set(['releases', 'superlikes', 'likes', 'recommended']),
  player: PLAYER_HIDDEN,
  deck: PLAYER_HIDDEN,
};

export const EMPTY_LAYOUT: LayoutState = {
  sidebar: [],
  quick: [],
  library: [],
  home: [],
  player: [],
  deck: [],
};

export function deckFromPlayer(layouts: Partial<LayoutState> | undefined): LayoutState {
  const all = { ...EMPTY_LAYOUT, ...layouts };
  if (all.deck.length > 0 || all.player.length === 0) return all;
  return { ...all, deck: all.player.map(({ id, hidden }) => ({ id, hidden })) };
}

const NONE_GATED: ReadonlySet<string> = new Set();
const CHATS_GATED: ReadonlySet<string> = new Set(['chats']);

export function gatedIds(chatEnabled: boolean): ReadonlySet<string> {
  return chatEnabled ? NONE_GATED : CHATS_GATED;
}

function currentGated(): ReadonlySet<string> {
  return gatedIds(selectChatInNav(useChatStore.getState()));
}

export interface ResolvedEntry<T extends string> {
  id: T;
  hidden: boolean;
  zone?: Zone;
}

export function resolveLayout<T extends string>(
  saved: readonly LayoutEntry[] | undefined,
  ids: readonly T[],
  gated: ReadonlySet<string> = currentGated(),
  hiddenByDefault: ReadonlySet<string> = NO_IDS,
): ResolvedEntry<T>[] {
  const known = new Set<string>(ids.filter((id) => !gated.has(id)));
  const seen = new Set<string>();
  const out: ResolvedEntry<T>[] = [];
  for (const entry of saved ?? []) {
    if (!known.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    out.push({
      id: entry.id as T,
      hidden: !!entry.hidden,
      ...(entry.zone ? { zone: entry.zone } : {}),
    });
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
    out.splice(at, 0, { id, hidden: hiddenByDefault.has(id) });
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

export function resolvePlacement(
  saved: readonly LayoutEntry[] | undefined,
  surface: Surface,
): Placed<PlayerButtonId>[] {
  return placeZones(surface, resolveLayout(saved, PLAYER_IDS, NONE_GATED, PLAYER_HIDDEN));
}

export function isDefaultLayout(entries: readonly LayoutEntry[], scope: LayoutScope) {
  if (isSurface(scope)) return isDefaultPlacement(placeZones(scope, entries), scope);
  const gated = currentGated();
  const visible = LAYOUT_IDS[scope].filter((id) => !gated.has(id));
  return entries.every(
    (e, i) => e.id === visible[i] && e.hidden === DEFAULT_HIDDEN[scope].has(e.id),
  );
}
