import { listen } from '@tauri-apps/api/event';
import { usePlayerStore } from '../stores/player';

listen<string>('tray-action', (event) => {
  const store = usePlayerStore.getState();
  switch (event.payload) {
    case 'play_pause':
      store.togglePlay();
      break;
    case 'next':
      store.next();
      break;
    case 'prev':
      store.prev();
      break;
  }
});
