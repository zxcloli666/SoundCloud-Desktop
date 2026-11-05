import type { TFunction } from 'i18next';
import { toast } from 'sonner';
import { chatBridge } from '../../../../lib/chat/bridge';
import { useChatMediaStore } from '../../../../stores/chat/media';

const UNDO_MS = 5000;

export function removeAlbum(album: string, t: TFunction, onFail: (error: unknown) => void) {
  const media = useChatMediaStore.getState();
  media.setDismissed(album, true);
  let settled = false;
  const restore = () => {
    if (settled) return;
    settled = true;
    useChatMediaStore.getState().setDismissed(album, false);
  };
  const commit = () => {
    if (settled) return;
    settled = true;
    chatBridge
      .mediaAlbumCancel(album)
      .then(() => useChatMediaStore.getState().refreshUploads())
      .catch(onFail)
      .finally(() => useChatMediaStore.getState().setDismissed(album, false));
  };
  toast(t('chat.media.compose.albumRemoved'), {
    id: `album-${album}`,
    duration: UNDO_MS,
    action: { label: t('chat.media.compose.undo'), onClick: restore },
    onAutoClose: commit,
    onDismiss: commit,
  });
}
