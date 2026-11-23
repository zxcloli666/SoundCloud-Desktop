import { usePlayerStore } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { selectPreset } from '../effects';

export function resetSound() {
  selectPreset('off');
  useSettingsStore.getState().setEqEnabled(false);
  const player = usePlayerStore.getState();
  player.resetPlaybackRate();
  player.resetPitchSemitones();
}
