import { listen } from '@tauri-apps/api/event';
import { useAppStatusStore } from '../stores/app-status';
import { trackedInvoke as invoke } from './diagnostics';
import { requestProbe } from './host-status';
import { bootstrapPremium } from './subscription';

export async function initOfflineMode(): Promise<void> {
  await listen<boolean>('offline:changed', (event) => apply(event.payload)).catch(() => {});
  apply(await invoke<boolean>('offline_mode_get').catch(() => false));
}

export async function setOfflineMode(on: boolean): Promise<void> {
  apply(await invoke<boolean>('offline_mode_set', { on }));
}

function apply(on: boolean) {
  const status = useAppStatusStore.getState();
  if (status.offlineMode === on) return;
  status.setOfflineMode(on);
  if (on) return;
  requestProbe({ force: true });
  void bootstrapPremium();
}
