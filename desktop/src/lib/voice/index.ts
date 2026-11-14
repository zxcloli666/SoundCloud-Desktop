import { listenVoiceEvents } from './events';
import { refreshEngine, startConfigSync, startLikedArtists } from './sync';

let started = false;

export function initVoice() {
  if (started) return;
  started = true;
  listenVoiceEvents();
  startConfigSync();
  startLikedArtists();
  refreshEngine();
}
