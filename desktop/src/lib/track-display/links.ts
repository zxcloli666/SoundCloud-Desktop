import type {EnrichmentArtist, Track} from '../../stores/player';
import {type DisplayInput, getTrackDisplay} from './display';
import {foldName} from './fold';
import {splitNames} from './split';

/** Имя в строке авторов + куда оно ведёт (null — некликабельно). */
export interface ArtistLinkItem {
  name: string;
  target: string | null;
}

/**
 * Поимённые ссылки для строки авторов: каждое имя из `getTrackDisplay`
 * матчится (fold) на enrichment primary / co-primary / участников (→ страница
 * артиста) или на uploader'а (→ страница юзера). Цели регистрируются и под
 * полным именем, и под его компонентами — «Tyler, The Creator» кликабелен,
 * даже когда сплит порвал его на куски. Несматченное — просто текст.
 */
function computeLinkItems(track: DisplayInput): ArtistLinkItem[] {
  const display = getTrackDisplay(track);
  const targets = new Map<string, string>();
  const put = (name: string | undefined | null, target: string | null) => {
    if (!name || !target) return;
    const fullKey = foldName(name);
    if (fullKey && !targets.has(fullKey)) targets.set(fullKey, target);
    for (const part of splitNames(name)) {
      const pk = foldName(part);
      if (pk && !targets.has(pk)) targets.set(pk, target);
    }
  };
  const primary = track.enrichment?.primary_artist;
  if (primary?.id) put(primary.name, `/artist/${encodeURIComponent(primary.id)}`);
  for (const p of track.enrichment?.participants ?? []) {
    if (p.artist?.id) put(p.artist.name, `/artist/${encodeURIComponent(p.artist.id)}`);
  }
  if (track.user?.urn) put(track.user.username, `/user/${encodeURIComponent(track.user.urn)}`);
  return display.artistNames.map((name) => ({
    name,
    target: targets.get(foldName(name)) ?? null,
  }));
}

interface LinksCacheEntry {
  title: string;
  user: unknown;
  enrichment: unknown;
  items: ArtistLinkItem[];
}

const LINKS_CACHE = new WeakMap<object, LinksCacheEntry>();

export function getArtistLinkItems(track: DisplayInput): ArtistLinkItem[] {
  const key = track as object;
  const hit = LINKS_CACHE.get(key);
  if (
    hit &&
    hit.title === track.title &&
    hit.user === track.user &&
    hit.enrichment === track.enrichment
  ) {
    return hit.items;
  }
  const items = computeLinkItems(track);
  LINKS_CACHE.set(key, {
    title: track.title,
    user: track.user,
    enrichment: track.enrichment,
    items,
  });
  return items;
}

/**
 * Куда ведёт клик по «строке авторов целиком» (карточки, где имена не
 * раскликаны поимённо): первый слинкованный участник — ТО ЖЕ направление,
 * что и у первого имени в ArtistNameLinks. Раньше тут был свой гейт по
 * verified, и одно и то же имя вело в разные места из списка и из карточки.
 */
export function getArtistTarget(
  track: Pick<Track, 'title' | 'user' | 'enrichment'>,
): string | null {
  const linked = getArtistLinkItems(track).find((it) => it.target);
  if (linked?.target) return linked.target;
  if (track.user?.urn) {
    return `/user/${encodeURIComponent(track.user.urn)}`;
  }
  return null;
}

export function getAlbumTarget(track: Pick<Track, 'enrichment'>): string | null {
  const id = track.enrichment?.album?.id;
  return id ? `/album/${encodeURIComponent(id)}` : null;
}

export interface ParticipantsBreakdown {
  featured: EnrichmentArtist[];
  remixers: EnrichmentArtist[];
  producers: EnrichmentArtist[];
}

export function getParticipants(
  track: Pick<Track, 'enrichment'>,
  roles: ReadonlyArray<string> = ['featured', 'remixer', 'producer'],
): ParticipantsBreakdown | null {
  const items = track.enrichment?.participants?.filter((p) => roles.includes(p.role)) ?? [];
  if (items.length === 0) return null;
  const featured = items.filter((p) => p.role === 'featured').map((p) => p.artist);
  const remixers = items.filter((p) => p.role === 'remixer').map((p) => p.artist);
  const producers = items.filter((p) => p.role === 'producer').map((p) => p.artist);
  if (featured.length === 0 && remixers.length === 0 && producers.length === 0) return null;
  return { featured, remixers, producers };
}
