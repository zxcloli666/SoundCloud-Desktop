import { ApiError, apiRequest, getSessionId } from './api-client';
import { trackedInvoke as invoke, onDiagQueueFull } from './diagnostics';
import i18n from '../i18n';
import { getIsPremium } from './premium-cache';
import { requestedQuality } from './streaming';

export type ReportTrigger = 'manual' | 'render' | 'netcheck';
export type ReportResult = { code: string } | { file: string };

interface EventBatch {
  events: unknown[];
}

const UPLOAD_TIMEOUT_MS = 20_000;
const FLUSH_EVERY_MS = 60_000;

let flushing = false;

async function pushSession() {
  await invoke('diag_session', {
    loggedIn: !!getSessionId(),
    premium: getIsPremium(),
    quality: requestedQuality(),
    locale: i18n.language,
  });
}

export async function sendReport(trigger: ReportTrigger): Promise<ReportResult> {
  await pushSession();
  const bundle = await invoke<string>('diag_bundle', { trigger });
  try {
    const created = await apiRequest<{ code: string }>(
      '/diag/bundles',
      { method: 'POST', body: bundle, quiet: true },
      UPLOAD_TIMEOUT_MS,
    );
    return { code: created.code };
  } catch {
    return { file: await invoke<string>('diag_save_file', { bundle }) };
  }
}

async function flushEvents() {
  if (flushing) return;
  flushing = true;
  try {
    await pushSession();
    const batch = await invoke<EventBatch | null>('diag_queue_batch');
    if (!batch) return;
    try {
      await apiRequest(
        '/diag/events',
        { method: 'POST', body: JSON.stringify(batch), quiet: true },
        UPLOAD_TIMEOUT_MS,
      );
      await invoke('diag_queue_settle', { delivery: 'sent' });
    } catch (error) {
      const refused = error instanceof ApiError && error.status >= 400 && error.status < 500;
      await invoke('diag_queue_settle', { delivery: refused ? 'rejected' : 'failed' });
    }
  } finally {
    flushing = false;
  }
}

export function startDiag(enabled: boolean) {
  void invoke('diag_set_reporting', { enabled });
  onDiagQueueFull(() => void flushEvents());
  window.setInterval(() => void flushEvents(), FLUSH_EVERY_MS);
}

export function setReporting(enabled: boolean) {
  void invoke('diag_set_reporting', { enabled });
}
