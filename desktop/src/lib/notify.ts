import { type ExternalToast, toast } from 'sonner';
import { useSettingsStore } from '../stores/settings';
import { logError } from './diagnostics';

export function notifyError(title: string, options?: ExternalToast) {
  const detail = typeof options?.description === 'string' ? `: ${options.description}` : '';
  logError(`[Notify] ${title}${detail}`);
  if (!useSettingsStore.getState().showErrorToasts) return;
  toast.error(title, options);
}
