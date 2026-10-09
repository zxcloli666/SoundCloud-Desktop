import { listen } from '@tauri-apps/api/event';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import i18n from '../i18n';
import { trackedInvoke as invoke } from './diagnostics';

export interface StorageLocationInfo {
  path: string;
  defaultPath: string;
  isDefault: boolean;
  unavailablePath: string | null;
}

export interface RelocateProgress {
  files: number;
  totalFiles: number;
  bytes: number;
  totalBytes: number;
}

const RELOCATE_ERRORS = new Set([
  'busy',
  'missing',
  'same',
  'nested',
  'not_writable',
  'no_space',
  'sandboxed',
]);

export function getStorageLocation(): Promise<StorageLocationInfo> {
  return invoke<StorageLocationInfo>('storage_location_info');
}

export function relocateStorage(target: string | null, moveFiles: boolean): Promise<string> {
  return invoke<string>('storage_relocate', { target, moveFiles });
}

export function openStorageFolder(): Promise<void> {
  return invoke<void>('storage_open_folder');
}

export function restartApp(): Promise<void> {
  return invoke<void>('app_restart');
}

export async function pickStorageFolder(defaultPath: string): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({ directory: true, multiple: false, defaultPath });
  return typeof picked === 'string' ? picked : null;
}

export function relocateErrorKey(error: unknown): string {
  const code = String(error);
  return RELOCATE_ERRORS.has(code)
    ? `settings.storageError.${code}`
    : 'settings.storageError.failed';
}

export function useRelocateProgress(active: boolean): RelocateProgress | null {
  const [progress, setProgress] = useState<RelocateProgress | null>(null);

  useEffect(() => {
    if (!active) {
      setProgress(null);
      return;
    }
    let unlisten: (() => void) | undefined;
    let disposed = false;
    void listen<RelocateProgress>('storage:relocate-progress', (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [active]);

  return progress;
}

export async function warnIfStorageUnavailable() {
  const info = await getStorageLocation().catch(() => null);
  if (!info?.unavailablePath) return;
  toast.warning(i18n.t('settings.storageUnavailableToast'), {
    description: info.unavailablePath,
    duration: 12_000,
  });
}
