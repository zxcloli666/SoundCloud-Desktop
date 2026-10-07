/**
 * Единая точка дозагрузки очереди когда она кончилась.
 *
 * Триггерится из player store: как только `next()` упирается в конец очереди
 * с repeat='off', она зовёт зарегистрированный здесь fallback вместо паузы.
 * Это покрывает оба сценария:
 *   1) трек докрутился до конца естественно → audio:ended → handleTrackEnd → next()
 *   2) юзер вручную клацнул "Next" на последнем треке → next()
 *
 * Стратегия (по приоритету):
 *   0) контекстный источник (лайки/плейлист/…), если активен — доигрываем его
 *      ДО КОНЦА, подкачивая страницы (см. lib/queue-continuation.ts);
 *   1) "волна от трека" (Qdrant + bandit);
 *   2) фоллбек на похожие треки `/tracks/{urn}/related`.
 * Волна одинакова для всех источников (home, артист, лайки, поиск, плейлист).
 *
 * Не вызывать параллельно: повторный вызов пока летит первый — игнор.
 */

import {
  setEndOfQueueFallback,
  setPlaybackContextResetHandler,
  type Track,
  usePlayerStore,
} from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { trackUrn } from './ids';
import { getQueueContinuationSource, setQueueContinuationSource } from './queue-continuation';
import { fetchRelatedTracks } from './related';
import { fetchSmartWave } from './soundwave';

let inFlight = false;

export async function autopilotContinueFromTrack(lastTrack: Track): Promise<void> {
  if (inFlight) {
    console.debug('[autopilot] skipping — already in flight');
    return;
  }
  inFlight = true;

  try {
    // 0) Контекст (лайки/…) доигрывается до конца перед волной.
    if (await continueFromContextSource()) return;

    // 1–2) Источник иссяк или его нет → волна от последнего трека.
    console.debug('[autopilot] wave continuation from', lastTrack.urn, lastTrack.title);
    const fresh = await fetchContinuation(lastTrack);
    if (fresh.length === 0) {
      console.warn('[autopilot] no continuation tracks (wave + related both empty)');
      usePlayerStore.getState().pause();
      return;
    }
    console.debug('[autopilot] adding', fresh.length, 'wave tracks to queue');
    usePlayerStore.getState().addToQueue(fresh);
    usePlayerStore.getState().next();
  } catch (e) {
    console.error('[autopilot] continuation failed:', e);
    usePlayerStore.getState().pause();
  } finally {
    inFlight = false;
  }
}

/**
 * Дотягивает очередь из активного контекстного источника.
 * @returns true — добавили порцию свежих треков и поехали дальше; false —
 *   источника нет / он исчерпан / упал (тогда вызывающий уходит в волну).
 */
async function continueFromContextSource(): Promise<boolean> {
  const source = getQueueContinuationSource();
  if (!source) return false;

  const existing = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
  // Тянем страницы пока не наберём свежие треки либо источник не кончится
  // (страница может оказаться целиком из дублей, уже доскролленных в очередь).
  for (;;) {
    let batch: Track[];
    try {
      batch = await source.next();
    } catch (e) {
      console.debug(`[autopilot] source "${source.kind}" failed → wave:`, e);
      setQueueContinuationSource(null);
      return false;
    }
    if (batch.length === 0) {
      console.debug(`[autopilot] source "${source.kind}" exhausted → wave`);
      setQueueContinuationSource(null);
      return false;
    }
    const freshOnes = batch.filter((t) => !existing.has(t.urn));
    if (freshOnes.length > 0) {
      console.debug(`[autopilot] source "${source.kind}" +${freshOnes.length} tracks`);
      usePlayerStore.getState().addToQueue(freshOnes);
      usePlayerStore.getState().next();
      return true;
    }
    for (const t of batch) existing.add(t.urn);
  }
}

async function fetchContinuation(seed: Track): Promise<Track[]> {
  const existing = new Set(usePlayerStore.getState().queue.map((t) => t.urn));

  const fromWave = await fetchWaveContinuation(seed);
  const waveFresh = fromWave.filter((t) => !existing.has(t.urn));
  if (waveFresh.length > 0) {
    console.debug('[autopilot] using wave-from-track,', waveFresh.length, 'fresh tracks');
    return waveFresh;
  }

  console.debug('[autopilot] wave empty → falling back to related');
  const fromRelated = await fetchRelated(seed);
  const relatedFresh = fromRelated.filter((t) => !existing.has(t.urn));
  console.debug('[autopilot] related returned', relatedFresh.length, 'fresh tracks');
  return relatedFresh;
}

async function fetchWaveContinuation(seed: Track): Promise<Track[]> {
  const seedUrn = trackUrn(seed.urn);
  if (!seedUrn) return [];
  try {
    const batch = await fetchSmartWave({
      seedKind: 'track',
      seedId: seedUrn,
      limit: 20,
      hideListened: useSettingsStore.getState().soundwaveHideListened,
    });
    return batch.tracks;
  } catch (e) {
    console.debug('[autopilot] wave fetch failed:', e);
    return [];
  }
}

async function fetchRelated(seed: Track): Promise<Track[]> {
  try {
    const res = await fetchRelatedTracks(seed.urn, 20);
    return res.collection;
  } catch (e) {
    console.debug('[autopilot] related fetch failed:', e);
    return [];
  }
}

// Регистрируем при загрузке модуля. Сторе пнёт сюда при end-of-queue,
// а при старте нового play() — сбросит контекстный источник.
setEndOfQueueFallback(autopilotContinueFromTrack);
setPlaybackContextResetHandler(() => setQueueContinuationSource(null));
