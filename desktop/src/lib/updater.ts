import { Channel, invoke } from '@tauri-apps/api/core';
import { trackedInvoke } from './diagnostics';

export type InstallKind =
  | 'nsis'
  | 'msi'
  | 'portable'
  | 'macApp'
  | 'appImage'
  | 'deb'
  | 'rpm'
  | 'aur'
  | 'flatpak'
  | 'source';

export interface UpdaterInfo {
  os: string;
  arch: string;
  kind: InstallKind;
  selfUpdate: boolean;
}

export type InstallProgress =
  | { event: 'started'; data: { total: number | null } }
  | { event: 'progress'; data: { downloaded: number; total: number | null } }
  | { event: 'installing' };

let infoRequest: Promise<UpdaterInfo> | null = null;

export function getUpdaterInfo(): Promise<UpdaterInfo> {
  infoRequest ??= trackedInvoke<UpdaterInfo>('updater_info').catch((error) => {
    infoRequest = null;
    throw error;
  });
  return infoRequest;
}

export function installUpdate(onProgress: (progress: InstallProgress) => void): Promise<void> {
  const channel = new Channel<InstallProgress>();
  channel.onmessage = onProgress;
  return invoke<void>('updater_install', { onProgress: channel });
}
