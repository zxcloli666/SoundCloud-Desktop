import type { Track } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { fetchSmartWave } from '../soundwave';

const SEEDS = 5;
const BATCH = 8;

export type SearchWave = () => Promise<Track[]>;

export function searchWave(found: Track[]): SearchWave {
  const seeds = found.slice(0, SEEDS).map((t) => t.urn);
  const cursors = new Map<string, string>();
  const spent = new Set<string>();
  let turn = 0;

  return async function next() {
    const { soundwaveLanguages, soundwaveHideListened } = useSettingsStore.getState();
    while (spent.size < seeds.length) {
      const seed = seeds[turn % seeds.length];
      turn += 1;
      if (spent.has(seed)) continue;
      const batch = await fetchSmartWave({
        seedKind: 'track',
        seedId: seed,
        mode: 'moments',
        cursor: cursors.get(seed),
        limit: BATCH,
        languages: soundwaveLanguages,
        hideListened: soundwaveHideListened,
      });
      if (batch.cursor) cursors.set(seed, batch.cursor);
      if (batch.tracks.length === 0 || !batch.cursor) spent.add(seed);
      if (batch.tracks.length > 0) return batch.tracks;
    }
    return [];
  };
}
