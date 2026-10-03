/**
 * «Прослойка» дозагрузки очереди для конкретного контекста воспроизведения
 * (лайки, плейлист, лента подписок…). Пока активный источник не исчерпан, его
 * страницы доезжают в очередь раньше, чем включится волна: контекст играется
 * ДО КОНЦА. Источник кончился — отдаёт управление autopilot'у (волне), см.
 * lib/queue-autopilot.ts.
 *
 * Источник один на сессию воспроизведения: ставится при play() из контекста,
 * сбрасывается при старте нового play() (player store зовёт reset-handler) и
 * при исчерпании.
 */

import {shuffleArray, type Track, usePlayerStore} from '../stores/player';
import {useSettingsStore} from '../stores/settings';
import {api} from './api';
import {fetchAllLikedTracks, fetchAllPlaylistTracks} from './hooks';
import {fetchSmartWave} from './soundwave';

export interface QueueContinuationSource {
  /** Имя для логов. */
  readonly kind: string;

  /**
   * Следующая порция треков. Пустой массив = источник исчерпан (дальше волна).
   * Дубли отсеивает вызывающий по живой очереди — здесь чистая пагинация.
   */
  next(): Promise<Track[]>;
}

let active: QueueContinuationSource | null = null;

export function setQueueContinuationSource(src: QueueContinuationSource | null): void {
  active = src;
}

export function getQueueContinuationSource(): QueueContinuationSource | null {
  return active;
}

interface PagedTracks {
  collection: Track[];
  has_more: boolean;
}

/**
 * Источник из любого page-based эндпоинта `{ collection, has_more }`.
 * Тянет по странице за вызов; `has_more=false` или пустая страница = иссяк.
 */
export function createPagedContinuationSource(
  kind: string,
  base: string,
  opts?: { pageSize?: number; startPage?: number },
): QueueContinuationSource {
  const pageSize = opts?.pageSize ?? 50;
  let page = Math.max(0, opts?.startPage ?? 0);
  let done = false;
  return {
    kind,
    async next() {
      if (done) return [];
      const sep = base.includes('?') ? '&' : '?';
      const data = await api<PagedTracks>(`${base}${sep}limit=${pageSize}&page=${page}`);
      page += 1;
      const collection = data.collection ?? [];
      if (!data.has_more || collection.length === 0) done = true;
      return collection;
    },
  };
}

const LIKES_PAGE_SIZE = 50;
const PLAYLIST_PAGE_SIZE = 200;

/**
 * Лайки от и до. `alreadyLoaded` — сколько лайков уже в очереди при старте
 * (первая страница списка): пропускаем полностью покрытые страницы, стык
 * добивает дедуп на стороне autopilot'а.
 */
export function createLikesContinuationSource(alreadyLoaded = 0): QueueContinuationSource {
  return createPagedContinuationSource('likes', '/me/likes/tracks', {
    pageSize: LIKES_PAGE_SIZE,
    startPage: Math.floor(Math.max(0, alreadyLoaded) / LIKES_PAGE_SIZE),
  });
}

/**
 * Перемешанный ленивый источник под shuffle. На первом `next()` тянет ВЕСЬ набор
 * (`fetchAll`), отсекает то, что уже стоит в очереди (стартовая перемешанная
 * страница), тасует остаток и отдаёт кусками — так под shuffle играет весь набор
 * в случайном порядке, а очередь не раздувается разом. Исчерпался — autopilot
 * уходит в волну.
 */
function createShuffledContinuationSource(
  kind: string,
  fetchAll: () => Promise<Track[]>,
): QueueContinuationSource {
  let buffer: Track[] | null = null;
  let pos = 0;
  return {
    kind,
    async next() {
      if (buffer === null) {
        const all = await fetchAll();
        const queued = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
        buffer = all.filter((t) => !queued.has(t.urn));
        shuffleArray(buffer);
      }
      const chunk = buffer.slice(pos, pos + LIKES_PAGE_SIZE);
      pos += chunk.length;
      return chunk;
    },
  };
}

export function createShuffledLikesContinuationSource(): QueueContinuationSource {
  return createShuffledContinuationSource('likes-shuffled', () => fetchAllLikedTracks());
}

/**
 * Поставить «лайки до конца» под текущую (уже выставленную play()) очередь —
 * один вызов для всех точек входа в лайки (LikesTab, шелф на home, превью
 * в library, masthead-shuffle). Зовётся в `onPlay` сразу после play(): тот
 * сбросил прошлый источник, мы ставим свой.
 *
 * Под shuffle — источник тасует ВЕСЬ список лайков (а не только подгруженную
 * страницу). Без shuffle — последовательная пагинация со стартом из живой
 * длины очереди.
 */
export async function armLikesContinuation(): Promise<void> {
  const { shuffle, queue } = usePlayerStore.getState();
  if (shuffle) await armShuffledLikes();
  else setQueueContinuationSource(createLikesContinuationSource(queue.length));
}

async function armShuffledLikes(): Promise<void> {
  const source = createShuffledLikesContinuationSource();
  setQueueContinuationSource(source);
  try {
    const all = await fetchAllLikedTracks();
    if (active !== source) return;
    const queued = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
    const rest = all.filter((t) => !queued.has(t.urn));
    if (rest.length > 0) usePlayerStore.getState().addToQueue(rest);
    setQueueContinuationSource(null);
  } catch (e) {
    console.debug('[likes] full-collection fetch failed, staying on lazy continuation:', e);
  }
}

usePlayerStore.subscribe((state, prev) => {
  if (state.shuffle === prev.shuffle) return;
  if (active?.kind !== 'likes' && active?.kind !== 'likes-shuffled') return;
  if (state.shuffle) void armShuffledLikes();
  else setQueueContinuationSource(createLikesContinuationSource());
});

/**
 * Поставить «плейлист до конца» под текущую очередь — зовётся в `onPlay` сразу
 * после play() из плейлиста. Плейлист пагинируется (`usePlaylistTracks`), и
 * play() кладёт в очередь лишь подгруженный срез; без источника очередь кончалась
 * на нём и волна включалась посреди плейлиста. Тот же приём, что и у лайков.
 */
export function armPlaylistContinuation(playlistUrn: string): void {
  if (usePlayerStore.getState().shuffle) {
    setQueueContinuationSource(
      createShuffledContinuationSource('playlist-shuffled', () =>
        fetchAllPlaylistTracks(playlistUrn),
      ),
    );
    return;
  }
  const loaded = usePlayerStore.getState().queue.length;
  setQueueContinuationSource(
    createPagedContinuationSource(
      'playlist',
      `/playlists/${encodeURIComponent(playlistUrn)}/tracks`,
      {
        pageSize: PLAYLIST_PAGE_SIZE,
        startPage: Math.floor(Math.max(0, loaded) / PLAYLIST_PAGE_SIZE),
      },
    ),
  );
}

const TRACK_WAVE_PAGE_SIZE = 20;

function createTrackWaveContinuationSource(seedId: string): QueueContinuationSource {
  let cursor: string | undefined;
  return {
    kind: 'track-wave',
    async next() {
      const batch = await fetchSmartWave({
        seedKind: 'track',
        seedId,
        cursor,
        limit: TRACK_WAVE_PAGE_SIZE,
        hideListened: useSettingsStore.getState().soundwaveHideListened,
      });
      if (batch.cursor) cursor = batch.cursor;
      return batch.tracks;
    },
  };
}

export async function armTrackWaveContinuation(): Promise<void> {
  const seedId = usePlayerStore.getState().currentTrack?.urn.split(':').pop();
  if (!seedId) return;
  const source = createTrackWaveContinuationSource(seedId);
  setQueueContinuationSource(source);
  const first = await source.next();
  if (active !== source) return;
  const queued = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
  const fresh = first.filter((t) => !queued.has(t.urn));
  if (fresh.length > 0) usePlayerStore.getState().addToQueue(fresh);
}
