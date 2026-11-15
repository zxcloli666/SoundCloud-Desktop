import {
  BaseDirectory,
  exists,
  mkdir,
  readTextFile,
  remove,
  writeTextFile,
} from '@tauri-apps/plugin-fs';
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';
import { latestWrites } from './latest-write';

const BASE_DIR = BaseDirectory.AppData;

let dirReady: Promise<void> | null = null;

function ensureDir() {
  if (!dirReady) {
    dirReady = mkdir('', { baseDir: BASE_DIR, recursive: true }).catch(() => {});
  }
  return dirReady;
}

function filePath(name: string) {
  return `${name}.json`;
}

const files = latestWrites<string | null>(async (name, value) => {
  await ensureDir();
  const path = filePath(name);
  if (value === null) await remove(path, { baseDir: BASE_DIR });
  else await writeTextFile(path, value, { baseDir: BASE_DIR });
});

export const tauriStorage: StateStorage = {
  getItem: async (name) => {
    await files.settled(name);
    await ensureDir();
    const path = filePath(name);
    try {
      if (await exists(path, { baseDir: BASE_DIR })) {
        return await readTextFile(path, { baseDir: BASE_DIR });
      }
    } catch {
      // first run or corrupted — treat as empty
    }
    return null;
  },

  setItem: (name, value) => files.write(name, value),

  removeItem: (name) => files.write(name, null),
};

export function createThrottledJsonStorage<S>(delayMs = 500): PersistStorage<S> {
  const pending = new Map<string, StorageValue<S>>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const lastWrite = new Map<string, number>();

  const write = (name: string) => {
    const value = pending.get(name);
    if (value === undefined) return;
    pending.delete(name);
    lastWrite.set(name, Date.now());
    void tauriStorage.setItem(name, JSON.stringify(value));
  };

  const flush = () => {
    for (const [name, timer] of timers) {
      clearTimeout(timer);
      timers.delete(name);
      write(name);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush();
    });
    window.addEventListener('beforeunload', flush);
  }

  return {
    getItem: async (name) => {
      const raw = await tauriStorage.getItem(name);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        return null;
      }
    },

    setItem: (name, value) => {
      pending.set(name, value);
      if (timers.has(name)) return;
      const since = Date.now() - (lastWrite.get(name) ?? 0);
      if (since >= delayMs) {
        write(name);
        return;
      }
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          write(name);
        }, delayMs - since),
      );
    },

    removeItem: (name) => {
      const timer = timers.get(name);
      if (timer) {
        clearTimeout(timer);
        timers.delete(name);
      }
      pending.delete(name);
      void tauriStorage.removeItem(name);
    },
  };
}
