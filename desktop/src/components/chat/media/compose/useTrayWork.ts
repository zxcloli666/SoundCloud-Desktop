import { useMemo } from 'react';
import type { ConvId } from '../../../../lib/chat/types';
import { uploadsIn, useChatMediaStore } from '../../../../stores/chat/media';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { stagedUploads } from './staged';
import { type TrayWork, trayWork } from './tray-scope';
import { useStagedAlbum } from './useStagedAlbum';

export function useThreadTrayWork(conversationId: ConvId): TrayWork {
  const staged = useStagedAlbum(conversationId);
  const uploads = useChatMediaStore((state) => state.uploads);
  return useMemo(
    () => trayWork(uploadsIn(uploads, conversationId), new Set(staged.id ? [staged.id] : [])),
    [uploads, conversationId, staged.id],
  );
}

export function useGlobalTrayWork(except: ConvId | null): TrayWork {
  const uploads = useChatMediaStore((state) => state.uploads);
  const sending = useChatMediaStore((state) => state.sending);
  const threads = useChatThreadStore((state) => state.threads);
  return useMemo(() => {
    const shown = uploads.filter((upload) => upload.conversationId !== except);
    const chats = new Set(shown.map((upload) => upload.conversationId));
    const staged = new Set<string>();
    for (const id of chats) {
      const thread = threads[id];
      if (thread?.load !== 'ready') continue;
      for (const upload of stagedUploads(id, shown, thread.messages, sending)) {
        staged.add(upload.album);
      }
    }
    return trayWork(shown, staged);
  }, [uploads, sending, threads, except]);
}
