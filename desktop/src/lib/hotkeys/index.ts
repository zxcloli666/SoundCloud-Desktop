import { listen } from '@tauri-apps/api/event';
import { usePlayerStore } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { getCurrentTime, getDuration, handlePrev, seek } from '../audio';
import { toggleLikeCurrent } from '../tray';
import { GLOBAL_SEEK_STEP_SECONDS, GLOBAL_VOLUME_STEP, type GlobalHotkeyAction } from './actions';
import { hotkeysSuspended, loadHotkeyBackend, syncGlobalHotkeys } from './runtime';

let started = false;

function nudgeVolume(direction: 1 | -1) {
  const player = usePlayerStore.getState();
  player.setVolume(player.volume + direction * GLOBAL_VOLUME_STEP);
}

function nudgePosition(direction: 1 | -1) {
  const target = getCurrentTime() + direction * GLOBAL_SEEK_STEP_SECONDS;
  seek(Math.min(Math.max(target, 0), getDuration()));
}

function runAction(action: GlobalHotkeyAction) {
  const player = usePlayerStore.getState();
  switch (action) {
    case 'playPause':
      player.togglePlay();
      break;
    case 'next':
      player.next();
      break;
    case 'prev':
      handlePrev();
      break;
    case 'volumeUp':
      nudgeVolume(1);
      break;
    case 'volumeDown':
      nudgeVolume(-1);
      break;
    case 'mute':
      player.setVolume(player.volume > 0 ? 0 : player.volumeBeforeMute);
      break;
    case 'like':
      void toggleLikeCurrent();
      break;
    case 'seekForward':
      nudgePosition(1);
      break;
    case 'seekBack':
      nudgePosition(-1);
      break;
  }
}

export function initGlobalHotkeys() {
  if (started) return;
  started = true;

  loadHotkeyBackend();

  listen<GlobalHotkeyAction>('hotkey:pressed', (event) => {
    if (!hotkeysSuspended()) runAction(event.payload);
  });

  useSettingsStore.subscribe((state, prev) => {
    if (
      state.globalHotkeysEnabled !== prev.globalHotkeysEnabled ||
      state.globalHotkeys !== prev.globalHotkeys
    ) {
      void syncGlobalHotkeys();
    }
  });

  if (useSettingsStore.getState().globalHotkeysEnabled) void syncGlobalHotkeys();
}
