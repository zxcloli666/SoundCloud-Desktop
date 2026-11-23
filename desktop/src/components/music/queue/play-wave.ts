import { setWaveContext } from '../../../lib/queue-context';
import { fetchSmartWave } from '../../../lib/soundwave';
import { usePlayerStore } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';

export async function playWave(): Promise<boolean> {
  const settings = useSettingsStore.getState();
  const batch = await fetchSmartWave({
    seedKind: 'user',
    languages: settings.soundwaveLanguages,
    hideListened: settings.soundwaveHideListened,
  });
  const first = batch.tracks[0];
  if (!first) return false;
  usePlayerStore.getState().play(first, batch.tracks);
  setWaveContext('user');
  return true;
}
