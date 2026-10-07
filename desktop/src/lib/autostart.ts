import { trackedInvoke as invoke } from './diagnostics';

const PERMISSION_WAIT_MS = 120_000;

export interface AutostartState {
  enabled: boolean;
  startMinimized: boolean;
  trayAvailable: boolean;
}

export function getAutostart() {
  return invoke<AutostartState>('autostart_get');
}

export function setAutostartEnabled(enabled: boolean, reason: string) {
  return invoke<AutostartState>('autostart_set_enabled', { enabled, reason }, PERMISSION_WAIT_MS);
}

export function setAutostartMinimized(startMinimized: boolean) {
  return invoke<AutostartState>('autostart_set_minimized', { startMinimized });
}
