export const PLAYER_IDS = [
  'like',
  'dislike',
  'addToPlaylist',
  'album',
  'block',
  'quality',
  'more',
  'shuffle',
  'repeat',
  'together',
  'mic',
  'sound',
  'lyrics',
  'queue',
  'volume',
] as const;

export type PlayerButtonId = (typeof PLAYER_IDS)[number];

export const PLAYER_HIDDEN: ReadonlySet<string> = new Set([
  'dislike',
  'addToPlaylist',
  'album',
  'block',
  'quality',
  'mic',
]);

export type Surface = 'player' | 'deck';

export const ZONES = ['title', 'left', 'before', 'after', 'right'] as const;
export type Zone = (typeof ZONES)[number];

export const SURFACE_ZONES: Record<Surface, readonly Zone[]> = {
  player: ['left', 'before', 'after', 'right'],
  deck: ['title', 'left', 'before', 'after', 'right'],
};

export interface Placed<T extends string = string> {
  id: T;
  hidden: boolean;
  zone: Zone;
}

interface Loose<T extends string> {
  id: T;
  hidden: boolean;
  zone?: Zone;
}

const TRACK_IDS: ReadonlySet<string> = new Set([
  'like',
  'dislike',
  'addToPlaylist',
  'album',
  'block',
  'quality',
  'more',
]);
const DECK_TITLE_IDS: ReadonlySet<string> = new Set(['more', 'queue']);

export function isSurface(scope: string): scope is Surface {
  return scope === 'player' || scope === 'deck';
}

export function defaultZone(surface: Surface, id: string): Zone {
  if (surface === 'deck') {
    if (DECK_TITLE_IDS.has(id)) return 'title';
    if (id === 'sound') return 'left';
  }
  if (TRACK_IDS.has(id)) return 'left';
  if (id === 'shuffle') return 'before';
  if (id === 'repeat') return 'after';
  return 'right';
}

export function hasZone(surface: Surface, zone: string): zone is Zone {
  return SURFACE_ZONES[surface].includes(zone as Zone);
}

export function placeZones<T extends string>(
  surface: Surface,
  entries: readonly Loose<T>[],
): Placed<T>[] {
  const rank = SURFACE_ZONES[surface];
  return entries
    .map((entry) => ({
      id: entry.id,
      hidden: entry.hidden,
      zone:
        entry.zone && hasZone(surface, entry.zone) ? entry.zone : defaultZone(surface, entry.id),
    }))
    .sort((a, b) => rank.indexOf(a.zone) - rank.indexOf(b.zone));
}

export function defaultPlacement(surface: Surface): Placed<PlayerButtonId>[] {
  return placeZones(
    surface,
    PLAYER_IDS.map((id) => ({ id, hidden: PLAYER_HIDDEN.has(id) })),
  );
}

export function isDefaultPlacement(entries: readonly Placed[], surface: Surface): boolean {
  const want = defaultPlacement(surface);
  return (
    entries.length === want.length &&
    entries.every(
      (entry, i) =>
        entry.id === want[i].id && entry.hidden === want[i].hidden && entry.zone === want[i].zone,
    )
  );
}

export function placeButton<T extends string>(
  entries: readonly Placed<T>[],
  surface: Surface,
  id: string,
  zone: Zone,
  before: string | null,
): Placed<T>[] {
  const item = entries.find((entry) => entry.id === id);
  if (!item || !hasZone(surface, zone)) return [...entries];
  const rest = entries.filter((entry) => entry.id !== id);
  const at = before ? rest.findIndex((entry) => entry.id === before) : -1;
  const moved = { ...item, zone };
  const next = at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)];
  return placeZones(surface, next);
}

export type ZoneIds = Record<Zone, string[]>;

export function zoneIds(entries: readonly Placed[], withHidden = false): ZoneIds {
  const ids: ZoneIds = { title: [], left: [], before: [], after: [], right: [] };
  for (const entry of entries) if (withHidden || !entry.hidden) ids[entry.zone].push(entry.id);
  return ids;
}

export type ButtonAct = 'show' | 'hide' | 'move';

export type Arranged<T extends string> =
  | { state: 'ok'; entries: Placed<T>[]; zone: Zone; position: number; hidden: boolean }
  | { state: 'no_button' | 'no_zone' | 'bad_zone' };

export function arrange<T extends string>(
  entries: readonly Placed<T>[],
  surface: Surface,
  id: string,
  act: ButtonAct,
  zone: string | null,
  position: number | null,
): Arranged<T> {
  const item = entries.find((entry) => entry.id === id);
  if (!item) return { state: 'no_button' };
  if (act === 'move' && !zone) return { state: 'no_zone' };
  if (zone && !hasZone(surface, zone)) return { state: 'bad_zone' };
  const target = (zone as Zone | null) ?? item.zone;
  const shown = act !== 'hide';
  const peers = entries.filter((e) => e.zone === target && !e.hidden && e.id !== id);
  const slot = position == null ? peers.length : Math.min(Math.max(position - 1, 0), peers.length);
  const placed =
    act === 'move' || (zone && act === 'show')
      ? placeButton(entries, surface, id, target, peers[slot]?.id ?? null)
      : [...entries];
  const next = placed.map((entry) => (entry.id === id ? { ...entry, hidden: !shown } : entry));
  const row = next.filter((e) => e.zone === target && !e.hidden);
  const at = row.findIndex((e) => e.id === id) + 1;
  return { state: 'ok', entries: next, zone: target, position: at, hidden: !shown };
}

export type PlacementMap = Partial<Record<Zone, string[]>> & { hidden: string[] };

export function placementMap(entries: readonly Placed[], surface: Surface): PlacementMap {
  const ids = zoneIds(entries);
  const map: PlacementMap = { hidden: entries.filter((e) => e.hidden).map((e) => e.id) };
  for (const zone of SURFACE_ZONES[surface]) map[zone] = ids[zone];
  return map;
}
