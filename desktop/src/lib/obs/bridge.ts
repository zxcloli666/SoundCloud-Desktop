import { listen } from '@tauri-apps/api/event';
import { type ObsStatus, useObsStatusStore } from '../../stores/obs-status';
import { usePlayerStore } from '../../stores/player';
import { type SettingsState, useSettingsStore } from '../../stores/settings';
import { imageCacheKey } from '../asset-url';
import { getCurrentTime, getDuration } from '../audio';
import { trackedInvoke as invoke } from '../diagnostics';
import { getArtistDisplay, getDisplayTitle } from '../track-display';
import { isValidPort } from './format';

const DRIFT_SEC = 1.5;
const RESYNC_MS = 10000;
const CONFIG_KEYS = [
  'obsEnabled',
  'obsServer',
  'obsPort',
  'obsTxt',
  'obsTxtPath',
  'obsTemplate',
] as const satisfies ReadonlyArray<keyof SettingsState>;

let anchor = { position: 0, at: 0, playing: false };
let lastLabel = '';
let lastPlaying = false;
let lastUrn: string | null = null;

function enabled(): boolean {
  return useSettingsStore.getState().obsEnabled;
}

function snapshot() {
  const { currentTrack: track, isPlaying } = usePlayerStore.getState();
  const accent = useSettingsStore.getState().accentColor;
  if (!track) {
    return {
      hasTrack: false,
      title: '',
      artist: '',
      url: null,
      artworkUrl: null,
      coverKey: null,
      durationMs: 0,
      positionMs: 0,
      playing: false,
      accent,
    };
  }
  const artwork = (track.artwork_url || track.user?.avatar_url || '').replace(
    '-large',
    '-t500x500',
  );
  const position = getCurrentTime();
  return {
    hasTrack: true,
    title: getDisplayTitle(track),
    artist: getArtistDisplay(track).primary || track.user?.username || '',
    url: track.permalink_url?.replace(/\?.*$/, '') ?? null,
    artworkUrl: artwork || null,
    coverKey: artwork ? imageCacheKey(artwork) : null,
    durationMs: Math.round((getDuration() || track.duration / 1000) * 1000),
    positionMs: Math.round(position * 1000),
    playing: isPlaying,
    accent,
  };
}

function setStatus(status: ObsStatus) {
  useObsStatusStore.setState({ status });
}

function push() {
  if (!enabled()) return;
  const np = snapshot();
  anchor = { position: np.positionMs / 1000, at: performance.now(), playing: np.playing };
  void invoke<ObsStatus>('obs_update', { np })
    .then(setStatus)
    .catch(() => undefined);
}

export function configureObs() {
  const s = useSettingsStore.getState();
  const config = {
    server: s.obsEnabled && s.obsServer && isValidPort(s.obsPort),
    port: s.obsPort,
    txtPath: s.obsEnabled && s.obsTxt && s.obsTxtPath ? s.obsTxtPath : null,
    template: s.obsTemplate,
  };
  return invoke<ObsStatus>('obs_configure', { config })
    .then((status) => {
      setStatus(status);
      push();
    })
    .catch(() => undefined);
}

function expectedPosition(): number {
  if (!anchor.playing) return anchor.position;
  return anchor.position + (performance.now() - anchor.at) / 1000;
}

usePlayerStore.subscribe((state) => {
  if (!enabled()) return;
  const track = state.currentTrack;
  const label = track ? `${getDisplayTitle(track)}\n${getArtistDisplay(track).primary}` : '';
  const urn = track?.urn ?? null;
  if (urn === lastUrn && label === lastLabel && state.isPlaying === lastPlaying) return;
  lastUrn = urn;
  lastLabel = label;
  lastPlaying = state.isPlaying;
  push();
});

useSettingsStore.subscribe((state, prev) => {
  if (CONFIG_KEYS.some((key) => state[key] !== prev[key])) {
    void configureObs();
    return;
  }
  if (state.accentColor !== prev.accentColor) push();
});

listen<number>('audio:tick', (event) => {
  if (!enabled() || !usePlayerStore.getState().currentTrack) return;
  const drift = Math.abs(event.payload - expectedPosition());
  const stale = performance.now() - anchor.at > RESYNC_MS;
  if (drift > DRIFT_SEC || (anchor.playing && stale)) push();
});

if (enabled()) void configureObs();
