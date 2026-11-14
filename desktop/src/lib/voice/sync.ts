import { loadVoiceLocales } from '../../i18n';
import { useAuthStore } from '../../stores/auth';
import type { Track } from '../../stores/player';
import { api } from '../api';
import { type PagedResponse, pagedUrl, type SCUser } from '../hooks';
import { voiceIpc } from './ipc';
import { likedArtists } from './liked-artists';
import { engineConfig } from './names';
import { useVoiceRuntime } from './runtime';
import { useVoiceStore } from './store';

const APPLY_DEBOUNCE_MS = 120;
const LIKED_PAGE = 200;

function push() {
  loadVoiceLocales()
    .then((locales) => voiceIpc.apply(engineConfig(useVoiceStore.getState().config, locales)))
    .then(() => useVoiceRuntime.setState({ availability: 'ready' }))
    .catch(() => useVoiceRuntime.setState({ availability: 'missing' }));
}

export function refreshEngine() {
  voiceIpc
    .status()
    .then((status) =>
      useVoiceRuntime.setState({ status, devices: status.devices, availability: 'ready' }),
    )
    .catch(() => useVoiceRuntime.setState({ availability: 'missing' }));
  voiceIpc
    .models()
    .then((models) => useVoiceRuntime.getState().setModels(models))
    .catch(() => {});
}

export function startConfigSync() {
  if (useVoiceStore.persist.hasHydrated()) push();
  else useVoiceStore.persist.onFinishHydration(push);
  let timer: ReturnType<typeof setTimeout> | null = null;
  useVoiceStore.subscribe((state, prev) => {
    if (state.config === prev.config) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(push, APPLY_DEBOUNCE_MS);
  });
}

let likedOf: string | null = null;

async function readLikedArtists() {
  const [liked, followed] = await Promise.all([
    api<PagedResponse<Track>>(pagedUrl('/me/likes/tracks', 0, LIKED_PAGE)),
    api<PagedResponse<SCUser>>(pagedUrl('/me/followings', 0, LIKED_PAGE)),
  ]);
  const artists = likedArtists(liked.collection, followed.collection);
  const { config, patch } = useVoiceStore.getState();
  if (artists.join('\n') !== config.boosts.artists.join('\n')) patch({ boosts: { artists } });
}

function followLikedArtists() {
  const owner = useAuthStore.getState().user?.urn ?? null;
  if (!owner || likedOf === owner || !useVoiceStore.getState().config.enabled) return;
  likedOf = owner;
  readLikedArtists().catch(() => {
    likedOf = null;
  });
}

export function startLikedArtists() {
  followLikedArtists();
  useAuthStore.subscribe(followLikedArtists);
  useVoiceStore.subscribe(followLikedArtists);
}
