import { clampPitchSemitones, clampPlaybackRate, usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';
import {
  type TrackSound,
  type TrackSoundOverride,
  useTrackSoundStore,
} from '../stores/track-sound';

const MAX_OVERRIDES = 500;

type PersistedStore = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

let applying = false;
let started = false;

function readLive(): TrackSound {
  const { playbackRate, pitchSemitones, pitchControlMode } = usePlayerStore.getState();
  const { eqEnabled, eqGains, eqPreset } = useSettingsStore.getState();
  return {
    rate: playbackRate,
    pitch: pitchSemitones,
    pitchMode: pitchControlMode,
    eqEnabled,
    eqGains: [...eqGains],
    eqPreset,
  };
}

function applyLive(sound: TrackSound) {
  applying = true;
  try {
    usePlayerStore.setState({
      playbackRate: clampPlaybackRate(sound.rate),
      pitchSemitones: clampPitchSemitones(sound.pitch),
      pitchControlMode: sound.pitchMode,
    });
    useSettingsStore.setState({
      eqEnabled: sound.eqEnabled,
      eqGains: [...sound.eqGains],
      eqPreset: sound.eqPreset,
    });
  } finally {
    applying = false;
  }
}

function withOverride(
  overrides: Record<string, TrackSoundOverride>,
  urn: string,
  sound: TrackSound,
): Record<string, TrackSoundOverride> {
  const next = { ...overrides, [urn]: { ...sound, usedAt: Date.now() } };
  const urns = Object.keys(next);
  if (urns.length <= MAX_OVERRIDES) return next;
  const stale = urns
    .sort((a, b) => next[a].usedAt - next[b].usedAt)
    .slice(0, urns.length - MAX_OVERRIDES);
  for (const urn of stale) delete next[urn];
  return next;
}

export function rememberTrackSound(urn: string) {
  const live = readLive();
  useTrackSoundStore.setState((s) => ({
    overrides: withOverride(s.overrides, urn, live),
    active: { urn, baseline: s.active?.baseline ?? live },
  }));
}

export function forgetTrackSound(urn: string) {
  const { overrides, active } = useTrackSoundStore.getState();
  const { [urn]: _, ...rest } = overrides;
  const wasActive = active?.urn === urn;
  useTrackSoundStore.setState({ overrides: rest, active: wasActive ? null : active });
  if (wasActive) applyLive(active.baseline);
}

function syncTrack(urn: string | null) {
  const { overrides, active } = useTrackSoundStore.getState();
  const override = urn ? overrides[urn] : undefined;
  if (urn && override) {
    const baseline = active ? active.baseline : readLive();
    useTrackSoundStore.setState({
      overrides: withOverride(overrides, urn, override),
      active: { urn, baseline },
    });
    applyLive(override);
    return;
  }
  if (active) {
    useTrackSoundStore.setState({ active: null });
    applyLive(active.baseline);
  }
}

function captureLiveChange() {
  if (applying) return;
  const { active } = useTrackSoundStore.getState();
  const urn = usePlayerStore.getState().currentTrack?.urn;
  if (!active || active.urn !== urn) return;
  const live = readLive();
  useTrackSoundStore.setState((s) => ({ overrides: withOverride(s.overrides, urn, live) }));
}

function hydrated(store: PersistedStore) {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export async function initTrackSound() {
  if (started) return;
  started = true;
  await Promise.all([
    hydrated(usePlayerStore),
    hydrated(useSettingsStore),
    hydrated(useTrackSoundStore),
  ]);

  let urn = usePlayerStore.getState().currentTrack?.urn ?? null;
  syncTrack(urn);

  usePlayerStore.subscribe((state, prev) => {
    const nextUrn = state.currentTrack?.urn ?? null;
    if (nextUrn !== urn) {
      urn = nextUrn;
      syncTrack(nextUrn);
      return;
    }
    if (
      state.playbackRate !== prev.playbackRate ||
      state.pitchSemitones !== prev.pitchSemitones ||
      state.pitchControlMode !== prev.pitchControlMode
    ) {
      captureLiveChange();
    }
  });

  useSettingsStore.subscribe((state, prev) => {
    if (
      state.eqEnabled !== prev.eqEnabled ||
      state.eqGains !== prev.eqGains ||
      state.eqPreset !== prev.eqPreset
    ) {
      captureLiveChange();
    }
  });
}
