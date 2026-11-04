import { useMemo } from 'react';
import type { ConvId } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { hiddenAlbumKey } from './staged';
import { type TrayWork, trayWork } from './tray-scope';
import { useAlbumFlags } from './useAlbumFlags';

export function useTrayWork(current: ConvId | null): TrayWork {
  const uploads = useChatMediaStore((state) => state.uploads);
  const flags = useAlbumFlags();
  const hidden = useChatThreadStore((state) => hiddenAlbumKey(uploads, state.threads, flags));
  return useMemo(
    () => trayWork(uploads, new Set(hidden ? hidden.split(',') : []), current),
    [uploads, hidden, current],
  );
}
