import { markReload } from './themes/sentinel';

const MARK_WAIT_MS = 400;

export async function reloadApp(path?: string): Promise<void> {
  await Promise.race([
    markReload().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, MARK_WAIT_MS)),
  ]);
  if (path) window.location.assign(path);
  else window.location.reload();
}
