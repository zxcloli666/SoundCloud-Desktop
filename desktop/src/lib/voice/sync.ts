import { loadVoiceLocales } from '../../i18n';
import { useAuthStore } from '../../stores/auth';
import type { Track } from '../../stores/player';
import { api } from '../api';
import { onApiWrite } from '../api-writes';
import { type PagedResponse, pagedUrl, type SCUser } from '../hooks';
import { fetchAllSuperlikedTracks } from '../superlikes';
import { voiceIpc } from './ipc';
import { ownedTracks } from './library';
import { changesLikedArtists, likedArtists } from './liked-artists';
import { engineConfig } from './names';
import { useVoiceRuntime } from './runtime';
import { useVoiceStore } from './store';

const APPLY_DEBOUNCE_MS = 120;
const LIKED_PAGE = 200;
const LIKED_SETTLE_MS = 5_000;

function push() {
  loadVoiceLocales()
    .then((locales) => voiceIpc.apply(engineConfig(useVoiceStore.getState().config, locales)))
    .then(() => {
      useVoiceRuntime.setState({ availability: 'ready' });
      loadModels();
    })
    .catch(() => useVoiceRuntime.setState({ availability: 'missing' }));
}

function loadModels() {
  voiceIpc
    .models()
    .then((models) => useVoiceRuntime.getState().setModels(models))
    .catch(() => {});
}

export function refreshEngine() {
  voiceIpc
    .status()
    .then((status) =>
      useVoiceRuntime.setState({ status, devices: status.devices, availability: 'ready' }),
    )
    .catch(() => useVoiceRuntime.setState({ availability: 'missing' }));
  loadModels();
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

async function readLibrary() {
  const [liked, followed, superliked] = await Promise.all([
    api<PagedResponse<Track>>(pagedUrl('/me/likes/tracks', 0, LIKED_PAGE)),
    api<PagedResponse<SCUser>>(pagedUrl('/me/followings', 0, LIKED_PAGE)),
    fetchAllSuperlikedTracks().catch((): Track[] => []),
  ]);
  await voiceIpc.library(ownedTracks(superliked, liked.collection));
  const artists = likedArtists([...superliked, ...liked.collection], followed.collection);
  const { config, patch } = useVoiceStore.getState();
  if (artists.join('\n') !== config.boosts.artists.join('\n')) patch({ boosts: { artists } });
}

function followLibrary() {
  const owner = useAuthStore.getState().user?.urn ?? null;
  if (!owner || likedOf === owner || !useVoiceStore.getState().config.enabled) return;
  likedOf = owner;
  readLibrary().catch(() => {
    likedOf = null;
  });
}

let settling: ReturnType<typeof setTimeout> | null = null;

function rereadLibrary() {
  settling = null;
  const owner = useAuthStore.getState().user?.urn ?? null;
  if (!owner || likedOf !== owner || !useVoiceStore.getState().config.enabled) return;
  readLibrary().catch(() => {});
}

function followLibraryWrites(path: string) {
  if (!changesLikedArtists(path)) return;
  if (settling) clearTimeout(settling);
  settling = setTimeout(rereadLibrary, LIKED_SETTLE_MS);
}

export function startLibrary() {
  followLibrary();
  useAuthStore.subscribe(followLibrary);
  useVoiceStore.subscribe(followLibrary);
  onApiWrite(followLibraryWrites);
}
