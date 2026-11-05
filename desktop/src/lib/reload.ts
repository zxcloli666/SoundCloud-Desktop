import { isWindows } from './platform';
import { markReload } from './themes/sentinel';

const MARK_WAIT_MS = 1_000;

export async function reloadApp(path?: string): Promise<void> {
  await Promise.race([
    markReload().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, MARK_WAIT_MS)),
  ]);
  if (path) window.location.assign(path);
  else window.location.reload();
}

function isReloadKey(event: KeyboardEvent): boolean {
  if (event.code === 'F5') return !event.altKey;
  return event.code === 'KeyR' && event.ctrlKey && !event.altKey && !event.metaKey;
}

function onReloadKey(event: KeyboardEvent) {
  if (!isReloadKey(event)) return;
  event.preventDefault();
  if (!event.repeat) void reloadApp();
}

export function initReloadKeys() {
  if (isWindows()) window.addEventListener('keydown', onReloadKey, { capture: true });
}
