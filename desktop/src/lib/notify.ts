import { invoke } from '@tauri-apps/api/core';
import { type ExternalToast, toast } from 'sonner';
import { useSettingsStore } from '../stores/settings';
import { logError } from './diagnostics';

export function notifyError(title: string, options?: ExternalToast) {
  const detail = typeof options?.description === 'string' ? `: ${options.description}` : '';
  logError(`[Notify] ${title}${detail}`);
  if (!useSettingsStore.getState().showErrorToasts) return;
  toast.error(title, options);
}

async function osNotificationsAllowed(): Promise<boolean> {
  if (await invoke<boolean | null>('plugin:notification|is_permission_granted')) return true;
  return (await invoke<string>('plugin:notification|request_permission')) === 'granted';
}

export async function notifyOs(title: string, body: string): Promise<boolean> {
  try {
    if (!(await osNotificationsAllowed())) return false;
    await invoke('plugin:notification|notify', { options: { title, body } });
    return true;
  } catch (e) {
    logError(`[Notify] os notification failed: ${e}`);
    return false;
  }
}
