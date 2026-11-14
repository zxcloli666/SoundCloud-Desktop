import { isMac } from '../platform';
import type { VoiceConfig, VoiceLanguage } from './types';
import { DEFAULT_VOICE } from './voice-ids';

export function defaultHotkey(): string {
  return isMac() ? 'Shift+Super+Space' : 'Control+Shift+Space';
}

function defaultLanguage(): VoiceLanguage {
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function defaultConfig(): VoiceConfig {
  return {
    enabled: false,
    language: defaultLanguage(),
    activation: {
      hotkey: defaultHotkey(),
      hold: true,
      headset: 'off',
      wake: { on: false, sensitivity: 0.5 },
    },
    listen: { mode: 'chosen', devices: [] },
    speak: {
      mode: 'with_music',
      device: null,
      voice: DEFAULT_VOICE,
      speed: 1,
      pitch: 0,
      replies: true,
      server: false,
    },
    duck: 0.3,
    echo: 'auto',
    llm: true,
    boosts: { artists: [] },
  };
}
