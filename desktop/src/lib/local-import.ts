import { listen } from '@tauri-apps/api/event';
import i18n from '../i18n';
import { useLocalLibrary } from '../stores/local-library';
import { type Track, usePlayerStore } from '../stores/player';
import { trackedInvoke as invoke } from './diagnostics';
import {
  isLocalUrn,
  LOCAL_AUDIO_EXTENSIONS,
  type LocalTrackInfo,
  localIdOf,
  localTrackToTrack,
} from './local-library';

let listening = false;
let scanRunning = false;

function listenScanProgress() {
  if (listening) return;
  listening = true;
  void listen<{ done: number; total: number }>('local-library:scan-progress', (event) => {
    if (scanRunning) useLocalLibrary.getState().setScanning(event.payload);
  });
}

export function whenLocalLibraryReady(): Promise<void> {
  if (useLocalLibrary.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = useLocalLibrary.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

async function scan(paths: string[], explicitPaths: string[]): Promise<string[] | null> {
  if (scanRunning || paths.length === 0) return null;
  await whenLocalLibraryReady();
  listenScanProgress();
  scanRunning = true;
  useLocalLibrary.getState().setScanning({ done: 0, total: 0 });
  try {
    const found = await invoke<LocalTrackInfo[]>('local_library_scan', { paths });
    return useLocalLibrary.getState().merge(found, explicitPaths);
  } finally {
    scanRunning = false;
    useLocalLibrary.getState().setScanning(null);
  }
}

export function importLocalFiles(paths: string[]): Promise<string[] | null> {
  return scan(paths, paths);
}

export async function importLocalFolders(folders: string[]): Promise<string[] | null> {
  await whenLocalLibraryReady();
  useLocalLibrary.getState().addFolders(folders);
  return scan(folders, []);
}

export async function pickLocalFiles(): Promise<string[] | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({
    multiple: true,
    filters: [{ name: i18n.t('local.audioFiles'), extensions: LOCAL_AUDIO_EXTENSIONS }],
  });
  return picked && picked.length > 0 ? importLocalFiles(picked) : null;
}

export async function pickLocalFolder(): Promise<string[] | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ directory: true, multiple: true });
  return picked && picked.length > 0 ? importLocalFolders(picked) : null;
}

export async function refreshLocalMissing(): Promise<void> {
  await whenLocalLibraryReady();
  const { tracks } = useLocalLibrary.getState();
  const byPath = new Map(Object.values(tracks).map((t) => [t.path, t.id]));
  if (byPath.size === 0) return;
  const gone = await invoke<string[]>('local_library_missing', { paths: [...byPath.keys()] });
  useLocalLibrary.getState().setMissing(gone.flatMap((p) => byPath.get(p) ?? []));
}

export async function rescanLocalLibrary(): Promise<string[] | null> {
  await whenLocalLibraryReady();
  const added = await scan(useLocalLibrary.getState().folders, []);
  await refreshLocalMissing();
  return added;
}

export function forgetLocalTracks(ids: string[]): void {
  useLocalLibrary.getState().removeTracks(ids);
  void invoke('local_library_forget', { ids }).catch(() => {});
}

export function forgetLocalFolder(folder: string): void {
  const ids = useLocalLibrary.getState().removeFolder(folder);
  if (ids.length > 0) void invoke('local_library_forget', { ids }).catch(() => {});
}

export function localTracksFor(ids: string[]): Track[] {
  const { tracks } = useLocalLibrary.getState();
  return ids.flatMap((id) => (tracks[id] ? [localTrackToTrack(tracks[id])] : []));
}

export async function localTrackPath(urn: string): Promise<string | null> {
  const id = localIdOf(urn);
  if (!id) return null;
  await whenLocalLibraryReady();
  return useLocalLibrary.getState().tracks[id]?.path ?? null;
}

export function noteLocalDuration(urn: string, seconds: number): void {
  const id = localIdOf(urn);
  if (id && seconds > 0) useLocalLibrary.getState().setDuration(id, Math.round(seconds * 1000));
}

export function markLocalMissing(urn: string): void {
  const id = localIdOf(urn);
  if (!id) return;
  const { missing, setMissing } = useLocalLibrary.getState();
  setMissing([...Object.keys(missing), id]);
}

function refreshQueuedLocalTracks() {
  const { queue, currentTrack, replaceTrackMetadata } = usePlayerStore.getState();
  const urns = new Set(
    [...queue, ...(currentTrack ? [currentTrack] : [])]
      .map((t) => t.urn)
      .filter((urn) => isLocalUrn(urn)),
  );
  for (const urn of urns) {
    const [fresh] = localTracksFor([localIdOf(urn) ?? '']);
    if (fresh) replaceTrackMetadata(fresh);
  }
}

function whenPlayerReady(): Promise<void> {
  if (usePlayerStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = usePlayerStore.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

void Promise.all([whenLocalLibraryReady(), whenPlayerReady()]).then(refreshQueuedLocalTracks);
