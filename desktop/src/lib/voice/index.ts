import { listenVoiceEvents } from './events';
import { refreshEngine, startConfigSync, startLibrary } from './sync';

let started = false;

export function initVoice() {
  if (started) return;
  started = true;
  listenVoiceEvents();
  startConfigSync();
  startLibrary();
  refreshEngine();
}
