import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { StateStorage } from 'zustand/middleware';

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

export const tauriStorage: StateStorage = {
  getItem: async (name) => {
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

  setItem: async (name, value) => {
    await ensureDir();
    const path = filePath(name);
    try {
      await writeTextFile(path, value, { baseDir: BASE_DIR });
    } catch {
      // silently fail — don't break the app
    }
  },

  removeItem: async (name) => {
    const path = filePath(name);
    try {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(path, { baseDir: BASE_DIR });
    } catch {
      // file doesn't exist — ok
    }
  },
};
