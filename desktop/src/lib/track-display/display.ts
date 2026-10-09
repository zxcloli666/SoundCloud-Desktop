import type {Track, TrackAvailability} from '../../stores/player';
import {stripNoiseTags, stripRoleTags, stripTranslitParens} from './clean';
import {foldName} from './fold';
import {type NamePart, splitNamesWithOffsets, TITLE_SEPARATORS} from './split';

export type DisplayInput = Pick<Track, 'title' | 'user' | 'enrichment'>;

/** Единый результат разбора трека для отображения: что писать в заголовок
 *  и кого — в строку авторов. Все компоненты (карточки, очередь, плеер,
 *  оффлайн) обязаны брать отсюда, своих разборов не заводить. */
export interface TrackDisplay {
  title: string;
  /** Компоненты строки авторов в порядке показа. */
  artistNames: string[];
  /** Готовая строка авторов: "МОКЕРИ, Psychosis". */
  artistLine: string;
  /** true — авторы взяты из разметки "Artist1, Artist2 - Title" в тайтле. */
  fromTitleSplit: boolean;
}

export interface ArtistDisplay {
  primary: string;
  uploader: string | null;
  isEnriched: boolean;
  verified: boolean;
  confidence: number | null;
  pending: boolean;
  uploadKind: string | null;
  availability: TrackAvailability;
}

export type UploadKind = 'original' | 'demo' | 'alt' | 'reupload' | 'cover' | 'unknown';

/** Максимум имён в левой части, чтобы не принять предложение с запятыми
 *  за список авторов. */
const MAX_TITLE_ARTISTS = 6;

/** Известные имена трека по силе источника:
 *  - `strong` — из enrichment (primary/co-primary/участники), полные имена И
 *    их компоненты («МОКЕРИ, Psychosis» матчится и кусками;
 *  - `all` — strong + uploader;
 *  - `full` — только ПОЛНЫЕ имена (для склейки «Tyler, The Creator» обратно). */
interface KnownNames {
  strong: Set<string>;
  all: Set<string>;
  full: Set<string>;
}

function knownNames(track: DisplayInput): KnownNames {
  const strong = new Set<string>();
  const all = new Set<string>();
  const full = new Set<string>();
  const add = (name: string | undefined | null, isStrong: boolean) => {
    if (!name) return;
    const fullKey = foldName(name);
    if (fullKey) {
      full.add(fullKey);
      all.add(fullKey);
      if (isStrong) strong.add(fullKey);
    }
    for (const part of splitNamesWithOffsets(name)) {
      const pk = foldName(part.text);
      if (!pk) continue;
      all.add(pk);
      if (isStrong) strong.add(pk);
    }
  };
  add(track.enrichment?.primary_artist?.name, true);
  for (const p of track.enrichment?.participants ?? []) add(p.artist?.name, true);
  add(track.user?.username?.trim(), false);
  return { strong, all, full };
}

/** Co-primary артисты из enrichment.participants (role='primary'). */
export function coPrimaryNames(track: DisplayInput): string[] {
  return (
    track.enrichment?.participants
      ?.filter((p) => p.role === 'primary' && p.artist?.name)
      .map((p) => p.artist.name) ?? []
  );
}

/** Фитующие из enrichment.participants (role='featured'). */
export function featuredNames(track: DisplayInput): string[] {
  return (
    track.enrichment?.participants
      ?.filter((p) => p.role === 'featured' && p.artist?.name)
      .map((p) => p.artist.name) ?? []
  );
}

export function dedupeByFold(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = foldName(n);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

/** Склейка соседних кусков обратно в известное ПОЛНОЕ имя: сплит порвал
 *  "Tyler, The Creator" → [Tyler, The Creator], но сырой подотрезок целиком
 *  есть в `full` → возвращаем одним именем. Жадно, до 4 кусков. */
function glueKnownAdjacent(raw: string, parts: NamePart[], full: Set<string>): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < parts.length) {
    let matched = -1;
    for (let j = Math.min(parts.length - 1, i + 3); j > i; j--) {
      const span = raw.slice(parts[i].start, parts[j].end);
      if (full.has(foldName(span))) {
        matched = j;
        break;
      }
    }
    if (matched > i) {
      out.push(raw.slice(parts[i].start, parts[matched].end));
      i = matched + 1;
    } else {
      out.push(parts[i].text);
      i++;
    }
  }
  return out;
}

/**
 * Единый разбор трека для отображения. Фитующие из enrichment добираются в
 * строку авторов ПОСЛЕ основного состава («feat писать в списке авторов»).
 */
function computeTrackDisplay(track: DisplayInput): TrackDisplay {
  const base = splitTitleAuthors(track);
  const artistNames = dedupeByFold([...base.artistNames, ...featuredNames(track)]);
  return {
    title: base.title,
    artistNames,
    artistLine: artistNames.join(', '),
    fromTitleSplit: base.fromTitleSplit,
  };
}

/**
 * Разбор заголовка на (авторы, название).
 *
 * Левая часть "… - …" — список авторов, если подтверждена сигналом:
 * хотя бы одно имя известно из enrichment (сильный сигнал), ЛИБО известны
 * ВСЕ имена слева (когда единственный источник — uploader: «трек, друзья -
 * подпишитесь» не должен стать «авторами» из-за совпадения с ником).
 * "МОКЕРИ, Psychosis - kill" при известном «МОКЕРИ» → авторы
 * "МОКЕРИ, Psychosis", название "kill".
 */
function splitTitleAuthors(track: DisplayInput): TrackDisplay {
  const cleaned = stripTranslitParens(stripNoiseTags(track.title));
  const known = knownNames(track);

  for (const sep of TITLE_SEPARATORS) {
    const idx = cleaned.indexOf(sep);
    if (idx <= 0) continue;
    const left = stripRoleTags(cleaned.slice(0, idx)).trim();
    const right = cleaned.slice(idx + sep.length).trim();
    if (!right) continue;
    const parts = splitNamesWithOffsets(left);
    if (parts.length === 0 || parts.length > MAX_TITLE_ARTISTS) continue;
    const names = glueKnownAdjacent(left, parts, known.full);
    const confirmed =
      names.some((p) => known.strong.has(foldName(p))) ||
      names.every((p) => known.all.has(foldName(p)));
    if (confirmed) {
      const artistNames = dedupeByFold(names);
      return {
        title: right,
        artistNames,
        artistLine: artistNames.join(', '),
        fromTitleSplit: true,
      };
    }
  }

  // Перевёрнутая разметка "Track - Artist" (~4% дефисных тайтлов): слева
  // ничего знакомого, справа — целиком известные артисты.
  for (const sep of TITLE_SEPARATORS) {
    const idx = cleaned.indexOf(sep);
    if (idx <= 0) continue;
    const left = cleaned.slice(0, idx).trim();
    const right = stripRoleTags(cleaned.slice(idx + sep.length)).trim();
    if (!left || !right) continue;
    const parts = splitNamesWithOffsets(right);
    if (parts.length === 0 || parts.length > MAX_TITLE_ARTISTS) continue;
    const names = glueKnownAdjacent(right, parts, known.full);
    if (names.every((p) => known.all.has(foldName(p)))) {
      const artistNames = dedupeByFold(names);
      return {
        title: left,
        artistNames,
        artistLine: artistNames.join(', '),
        fromTitleSplit: true,
      };
    }
  }

  // Голый дефис ("Уннв-Без даты"): режем только когда левая часть целиком —
  // известный артист, иначе порвём имя вида "x-ray".
  const bareIdx = cleaned.indexOf('-');
  if (bareIdx > 0 && bareIdx + 1 < cleaned.length && cleaned[bareIdx + 1] !== '-') {
    const left = cleaned.slice(0, bareIdx).trim();
    const right = cleaned.slice(bareIdx + 1).trim();
    if (left && right && known.all.has(foldName(left))) {
      return {
        title: right,
        artistNames: [left],
        artistLine: left,
        fromTitleSplit: true,
      };
    }
  }

  const primaryName = track.enrichment?.primary_artist?.name;
  const uploader = track.user?.username?.trim() ?? '';
  const enriched = primaryName ? [primaryName, ...coPrimaryNames(track)] : [];
  const artistNames = dedupeByFold(enriched.length ? enriched : uploader ? [uploader] : []);
  return {
    title: cleaned,
    artistNames,
    artistLine: artistNames.join(', '),
    fromTitleSplit: false,
  };
}

/** Кэш разборов по identity трека (structural sharing TanStack Query держит
 *  объект стабильным между рендерами) с ревалидацией по полям-входам.
 *  Результат референсно стабилен → memo-компоненты не перерендериваются. */
interface CacheEntry {
  title: string;
  user: unknown;
  enrichment: unknown;
  display: TrackDisplay;
}

const DISPLAY_CACHE = new WeakMap<object, CacheEntry>();

export function getTrackDisplay(track: DisplayInput): TrackDisplay {
  const key = track as object;
  const hit = DISPLAY_CACHE.get(key);
  if (
    hit &&
    hit.title === track.title &&
    hit.user === track.user &&
    hit.enrichment === track.enrichment
  ) {
    return hit.display;
  }
  const display = computeTrackDisplay(track);
  DISPLAY_CACHE.set(key, {
    title: track.title,
    user: track.user,
    enrichment: track.enrichment,
    display,
  });
  return display;
}

export function getDisplayTitle(track: DisplayInput): string {
  return getTrackDisplay(track).title;
}

export function getArtistDisplay(track: DisplayInput): ArtistDisplay {
  const enrichment = track.enrichment;
  const real = enrichment?.primary_artist;
  const uploader = track.user?.username ?? '';
  const availability = (enrichment?.availability ?? 'indexed') as TrackAvailability;
  const pending = enrichment?.state === 'pending' || (!enrichment && availability === 'indexed');
  const uploadKind =
    enrichment?.upload_kind && enrichment.upload_kind !== 'unknown' ? enrichment.upload_kind : null;

  const display = getTrackDisplay(track);
  const isEnriched = Boolean(real?.name?.trim());

  if (!display.artistLine) {
    return {
      primary: uploader,
      uploader: null,
      isEnriched: false,
      verified: false,
      confidence: null,
      pending,
      uploadKind,
      availability,
    };
  }

  const uploaderShownAsArtist = display.artistNames.some((n) => foldName(n) === foldName(uploader));
  return {
    primary: display.artistLine,
    uploader: uploaderShownAsArtist || !uploader || availability !== 'indexed' ? null : uploader,
    isEnriched,
    verified: real?.verified === true,
    confidence: real?.confidence ?? null,
    pending: isEnriched ? false : pending,
    uploadKind,
    availability,
  };
}
