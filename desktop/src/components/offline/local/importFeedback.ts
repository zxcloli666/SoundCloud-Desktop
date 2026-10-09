import { toast } from 'sonner';
import i18n from '../../../i18n';
import { localTracksFor } from '../../../lib/local-import';
import { useLocalLibrary } from '../../../stores/local-library';
import { usePlayerStore } from '../../../stores/player';

const LOADING_DELAY_MS = 400;

export async function runLocalImport(
  task: () => Promise<string[] | null>,
  onShow?: () => void,
): Promise<void> {
  let loadingId: string | number | undefined;
  const timer = window.setTimeout(() => {
    if (useLocalLibrary.getState().scanning) loadingId = toast.loading(i18n.t('local.scanning'));
  }, LOADING_DELAY_MS);
  let added: string[] | null;
  try {
    added = await task();
  } catch (error) {
    console.warn('[Local] import failed:', error);
    toast.error(i18n.t('local.importFailed'), { id: loadingId });
    return;
  } finally {
    window.clearTimeout(timer);
  }
  if (added === null) {
    if (loadingId !== undefined) toast.dismiss(loadingId);
    return;
  }
  if (added.length === 0) {
    toast(i18n.t('local.nothingNew'), { id: loadingId });
    return;
  }
  const tracks = localTracksFor(added);
  toast.success(i18n.t('local.added', { count: added.length }), {
    id: loadingId,
    action: {
      label: i18n.t('local.playNow'),
      onClick: () => {
        if (tracks.length > 0) usePlayerStore.getState().play(tracks[0], tracks);
      },
    },
    cancel: onShow ? { label: i18n.t('local.show'), onClick: onShow } : undefined,
  });
}
