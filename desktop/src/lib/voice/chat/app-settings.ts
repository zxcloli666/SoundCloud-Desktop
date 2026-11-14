import {
  type LyricsHighlight,
  type StreamQuality,
  useSettingsStore,
} from '../../../stores/settings';
import { EQ_PRESETS } from '../../equalizer';
import type { PerfMode } from '../../perf';
import type { SchemeChoice } from '../../scheme';
import { useVoiceStore } from '../store';
import type { SettingKey, SettingValue } from './settings';

type Apply = (value: SettingValue) => void;

function app() {
  return useSettingsStore.getState();
}

function applyPreset(id: string) {
  app().setEqGains([...EQ_PRESETS[id].gains]);
  app().setEqPreset(id);
  app().setEqEnabled(true);
}

const APPLY: Record<SettingKey, Apply> = {
  theme: (v) => app().setScheme(v as SchemeChoice),
  performance: (v) => app().setPerfMode(v as PerfMode),
  equalizer: (v) => app().setEqEnabled(v === true),
  equalizer_preset: (v) => applyPreset(String(v)),
  normalize_volume: (v) => app().setNormalizeVolume(v === true),
  skip_silence: (v) => app().setSkipSilence(v === true),
  crossfade: (v) => app().setCrossfadeSec(Number(v)),
  stream_quality: (v) => app().setStreamQuality(v as StreamQuality),
  autoplay: (v) => app().setAutoplay(v === true),
  wave_mode: (v) => app().setSoundwaveMode(v === 'diverse' ? 'diverse' : 'similar'),
  wave_hide_liked: (v) => app().setSoundwaveHideLiked(v === true),
  wave_hide_listened: (v) => app().setSoundwaveHideListened(v === true),
  lyrics_highlight: (v) => app().setLyricsHighlight(v as LyricsHighlight),
  lyrics_visualizer: (v) => app().setLyricsVisualizer(v === true),
  floating_comments: (v) => app().setFloatingComments(v === true),
  spoken_replies: (v) => useVoiceStore.getState().patchSpeak({ replies: v === true }),
  voice_speed: (v) => useVoiceStore.getState().patchSpeak({ speed: Number(v) }),
};

export function applySetting(key: SettingKey, value: SettingValue) {
  APPLY[key](value);
}

export function readSettings(): Record<SettingKey, SettingValue> {
  const s = app();
  const speak = useVoiceStore.getState().config.speak;
  return {
    theme: s.scheme,
    performance: s.perfMode,
    equalizer: s.eqEnabled,
    equalizer_preset: s.eqPreset,
    normalize_volume: s.normalizeVolume,
    skip_silence: s.skipSilence,
    crossfade: s.crossfadeSec,
    stream_quality: s.streamQuality,
    autoplay: s.autoplay,
    wave_mode: s.soundwaveMode,
    wave_hide_liked: s.soundwaveHideLiked,
    wave_hide_listened: s.soundwaveHideListened,
    lyrics_highlight: s.lyricsHighlight,
    lyrics_visualizer: s.lyricsVisualizer,
    floating_comments: s.floatingComments,
    spoken_replies: speak.replies,
    voice_speed: speak.speed,
  };
}
