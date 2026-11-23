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

import { toast } from 'sonner';
import i18n from '../i18n';
import {
  setEndOfQueueFallback,
  setPlaybackContextResetHandler,
  type Track,
  usePlayerStore,
} from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import { withoutHidden } from './feed-filter';
import { trackUrn } from './ids';
import { isLocalUrn } from './local-library';
import {
  getQueueContinuationSource,
  type QueueContinuationSource,
  setQueueContinuationSource,
} from './queue-continuation';
import { fetchRelatedTracks } from './related';
import { fetchSmartWave } from './soundwave';

let playbackGen = 0;
let inFlightGen = -1;
const SOURCE_RETRY_DELAYS_MS = [1000, 3000, 8000];
const MIN_UP_NEXT = 3;
const TOP_UP_DEBOUNCE_MS = 180;
let topUpTimer: ReturnType<typeof setTimeout> | null = null;
let topUpUrn: string | null = null;

function isStale(gen: number, lastTrack: Track): boolean {
  return gen !== playbackGen || usePlayerStore.getState().currentTrack?.urn !== lastTrack.urn;
}

export async function autopilotContinueFromTrack(lastTrack: Track): Promise<void> {
  if (inFlightGen === playbackGen) {
    console.debug('[autopilot] skipping — already in flight');
    return;
  }
  const gen = playbackGen;
  inFlightGen = gen;
  const stale = () => isStale(gen, lastTrack);

  try {
    // 0) Контекст (лайки/…) доигрывается до конца перед волной.
    if (await continueFromContextSource(stale)) return;
    if (stale()) return;
    if (!useSettingsStore.getState().autoplay) {
      usePlayerStore.getState().pause();
      return;
    }

    if (isLocalUrn(lastTrack.urn)) {
      usePlayerStore.getState().pause();
      return;
    }

    // 1–2) Источник иссяк или его нет → волна от последнего трека.
    console.debug('[autopilot] wave continuation from', lastTrack.urn, lastTrack.title);
    const fresh = await fetchContinuation(lastTrack);
    if (stale()) return;
    if (fresh.length === 0) {
      console.warn('[autopilot] no continuation tracks (wave + related both empty)');
      toast(i18n.t('player.noContinuation'));
      usePlayerStore.getState().pause();
      return;
    }
    console.debug('[autopilot] adding', fresh.length, 'wave tracks to queue');
    usePlayerStore.getState().addToQueue(fresh, 'auto');
    usePlayerStore.getState().next();
  } catch (e) {
    console.error('[autopilot] continuation failed:', e);
    if (!stale()) usePlayerStore.getState().pause();
  } finally {
    if (inFlightGen === gen) inFlightGen = -1;
  }
}

/**
 * Дотягивает очередь из активного контекстного источника.
 * @returns true — добавили порцию свежих треков и поехали дальше; false —
 *   источника нет / он исчерпан / упал (тогда вызывающий уходит в волну).
 */
async function continueFromContextSource(stale: () => boolean): Promise<boolean> {
  const source = getQueueContinuationSource();
  if (!source) return false;

  const existing = new Set(usePlayerStore.getState().queue.map((t) => t.urn));
  // Тянем страницы пока не наберём свежие треки либо источник не кончится
  // (страница может оказаться целиком из дублей, уже доскролленных в очередь).
  for (;;) {
    let batch: Track[];
    try {
      batch = await nextFromSource(source, stale);
    } catch (e) {
      if (stale()) return false;
      console.debug(`[autopilot] source "${source.kind}" failed → wave:`, e);
      setQueueContinuationSource(null);
      return false;
    }
    if (stale()) return false;
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

async function nextFromSource(
  source: QueueContinuationSource,
  stale: () => boolean,
): Promise<Track[]> {
  for (const delay of SOURCE_RETRY_DELAYS_MS) {
    try {
      return await source.next();
    } catch (e) {
      if (stale()) throw e;
      console.debug(`[autopilot] source "${source.kind}" failed, retry in ${delay} ms:`, e);
      await new Promise((resolve) => setTimeout(resolve, delay));
      if (stale()) throw e;
    }
  }
  return source.next();
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
  const relatedFresh = withoutHidden(fromRelated).filter((t) => !existing.has(t.urn));
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
      languages: useSettingsStore.getState().soundwaveLanguages,
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

function scheduleQueueTopUp(): void {
  if (topUpTimer) clearTimeout(topUpTimer);
  topUpTimer = setTimeout(() => {
    topUpTimer = null;
    void topUpQueue();
  }, TOP_UP_DEBOUNCE_MS);
}

async function topUpQueue(): Promise<void> {
  const state = usePlayerStore.getState();
  const seed = state.currentTrack;
  const remaining = state.queue.length - state.queueIndex - 1;
  if (!seed || isLocalUrn(seed.urn) || state.repeat !== 'off') return;
  if (remaining >= MIN_UP_NEXT || topUpUrn === seed.urn) return;

  const source = getQueueContinuationSource();
  if (!source && !useSettingsStore.getState().autoplay) return;

  topUpUrn = seed.urn;
  try {
    const candidates = source ? await source.next() : await fetchContinuation(seed);
    const current = usePlayerStore.getState();
    if (current.currentTrack?.urn !== seed.urn) return;
    const known = new Set(current.queue.map((track) => track.urn));
    const fresh = candidates.filter((track) => !known.has(track.urn));
    if (fresh.length > 0) current.addToQueue(fresh, source ? undefined : 'auto');
  } catch (error) {
    console.debug('[autopilot] queue top-up failed:', error);
  } finally {
    if (topUpUrn === seed.urn) topUpUrn = null;
  }
}

// Регистрируем при загрузке модуля. Сторе пнёт сюда при end-of-queue,
// а при старте нового play() — сбросит контекстный источник.
setEndOfQueueFallback(autopilotContinueFromTrack);
setPlaybackContextResetHandler(() => {
  playbackGen++;
  setQueueContinuationSource(null);
  topUpUrn = null;
});

const unsubscribeTopUp = usePlayerStore.subscribe((state, previous) => {
  if (
    state.currentTrack?.urn !== previous.currentTrack?.urn ||
    state.queueIndex !== previous.queueIndex ||
    state.queue.length !== previous.queue.length
  ) {
    scheduleQueueTopUp();
  }
});
scheduleQueueTopUp();

import.meta.hot?.dispose(() => {
  unsubscribeTopUp();
  if (topUpTimer) clearTimeout(topUpTimer);
});
