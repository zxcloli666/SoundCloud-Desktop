import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LocalPlaylist, LocalTrack, LocalTrackInfo } from '../lib/local-library';
import { isMac, isWindows } from '../lib/platform';
import { createThrottledJsonStorage } from '../lib/tauri-storage';

export interface ScanProgress {
  done: number;
  total: number;
}

interface LocalLibraryState {
  tracks: Record<string, LocalTrack>;
  order: string[];
  folders: string[];
  excluded: string[];
  playlists: LocalPlaylist[];
  missing: Record<string, true>;
  scanning: ScanProgress | null;
  merge: (found: LocalTrackInfo[], explicitPaths: string[]) => string[];
  removeTracks: (ids: string[]) => void;
  addFolders: (folders: string[]) => void;
  removeFolder: (folder: string) => string[];
  setMissing: (ids: string[]) => void;
  setDuration: (id: string, durationMs: number) => void;
  reorder: (ids: string[]) => void;
  createPlaylist: (title: string, trackIds: string[]) => string;
  renamePlaylist: (id: string, title: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, trackIds: string[]) => number;
  removeFromPlaylist: (id: string, trackIds: string[]) => void;
  reorderPlaylist: (id: string, trackIds: string[]) => void;
  setScanning: (progress: ScanProgress | null) => void;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

const caseInsensitivePaths = isWindows() || isMac();

function pathKey(path: string): string {
  const key = path.replace(/[\\/]+/g, '/').replace(/\/$/, '');
  return caseInsensitivePaths ? key.toLowerCase() : key;
}

function underFolder(path: string, folder: string): boolean {
  return pathKey(path).startsWith(`${pathKey(folder)}/`);
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  return paths.filter((path) => {
    const key = pathKey(path);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function patchPlaylist(
  playlists: LocalPlaylist[],
  id: string,
  patch: (playlist: LocalPlaylist) => LocalPlaylist,
): LocalPlaylist[] {
  return playlists.map((p) => (p.id === id ? patch(p) : p));
}

function withoutTracks(
  state: Pick<LocalLibraryState, 'tracks' | 'order' | 'playlists'>,
  ids: string[],
): Pick<LocalLibraryState, 'tracks' | 'order' | 'playlists'> {
  const drop = new Set(ids);
  const tracks = { ...state.tracks };
  for (const id of ids) delete tracks[id];
  return {
    tracks,
    order: state.order.filter((id) => !drop.has(id)),
    playlists: state.playlists.map((p) => ({
      ...p,
      trackIds: p.trackIds.filter((id) => !drop.has(id)),
    })),
  };
}

export const useLocalLibrary = create<LocalLibraryState>()(
  persist(
    (set, get) => ({
      tracks: {},
      order: [],
      folders: [],
      excluded: [],
      playlists: [],
      missing: {},
      scanning: null,

      merge: (found, explicitPaths) => {
        const explicit = new Set(explicitPaths.map(pathKey));
        const excluded = get().excluded.filter((p) => !explicit.has(pathKey(p)));
        const blocked = new Set(excluded.map(pathKey));
        const tracks = { ...get().tracks };
        const missing = { ...get().missing };
        const added: string[] = [];
        const now = Date.now();
        for (const info of found) {
          if (blocked.has(pathKey(info.path))) continue;
          const existing = tracks[info.id];
          tracks[info.id] = {
            ...info,
            durationMs: info.durationMs ?? existing?.durationMs ?? null,
            addedAt: existing?.addedAt ?? now,
          };
          delete missing[info.id];
          if (!existing) added.push(info.id);
        }
        set({ tracks, missing, excluded, order: [...added, ...get().order] });
        return added;
      },

      removeTracks: (ids) =>
        set((s) => {
          const paths = ids.flatMap((id) => (s.tracks[id] ? [s.tracks[id].path] : []));
          return {
            ...withoutTracks(s, ids),
            excluded: uniquePaths([...s.excluded, ...paths]),
          };
        }),

      addFolders: (folders) => set((s) => ({ folders: uniquePaths([...s.folders, ...folders]) })),

      removeFolder: (folder) => {
        const ids = Object.values(get().tracks)
          .filter((t) => underFolder(t.path, folder))
          .map((t) => t.id);
        set((s) => ({
          ...withoutTracks(s, ids),
          folders: s.folders.filter((f) => pathKey(f) !== pathKey(folder)),
          excluded: s.excluded.filter((p) => !underFolder(p, folder)),
        }));
        return ids;
      },

      setMissing: (ids) =>
        set({ missing: Object.fromEntries(ids.map((id) => [id, true as const])) }),

      setDuration: (id, durationMs) =>
        set((s) => {
          const track = s.tracks[id];
          if (!track || Math.abs((track.durationMs ?? 0) - durationMs) < 1000) return s;
          return { tracks: { ...s.tracks, [id]: { ...track, durationMs } } };
        }),

      reorder: (ids) => set({ order: ids }),

      createPlaylist: (title, trackIds) => {
        const id = newId();
        set((s) => ({
          playlists: [
            ...s.playlists,
            { id, title, trackIds: [...new Set(trackIds)], createdAt: Date.now() },
          ],
        }));
        return id;
      },

      renamePlaylist: (id, title) =>
        set((s) => ({ playlists: patchPlaylist(s.playlists, id, (p) => ({ ...p, title })) })),

      deletePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),

      addToPlaylist: (id, trackIds) => {
        const playlist = get().playlists.find((p) => p.id === id);
        if (!playlist) return 0;
        const fresh = trackIds.filter((t) => !playlist.trackIds.includes(t));
        set((s) => ({
          playlists: patchPlaylist(s.playlists, id, (p) => ({
            ...p,
            trackIds: [...p.trackIds, ...fresh],
          })),
        }));
        return fresh.length;
      },

      removeFromPlaylist: (id, trackIds) => {
        const drop = new Set(trackIds);
        set((s) => ({
          playlists: patchPlaylist(s.playlists, id, (p) => ({
            ...p,
            trackIds: p.trackIds.filter((t) => !drop.has(t)),
          })),
        }));
      },

      reorderPlaylist: (id, trackIds) =>
        set((s) => ({ playlists: patchPlaylist(s.playlists, id, (p) => ({ ...p, trackIds })) })),

      setScanning: (scanning) => set({ scanning }),
    }),
    {
      name: 'sc-local-library',
      storage: createThrottledJsonStorage(),
      version: 1,
      partialize: (state) => ({
        tracks: state.tracks,
        order: state.order,
        folders: state.folders,
        excluded: state.excluded,
        playlists: state.playlists,
      }),
    },
  ),
);
