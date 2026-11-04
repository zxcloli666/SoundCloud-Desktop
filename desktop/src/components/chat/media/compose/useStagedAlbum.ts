import { useMemo } from 'react';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { readyMessages, stagedUploads } from './staged';
import { useAlbumFlags } from './useAlbumFlags';

export interface StagedAlbum {
  id: string | null;
  uploads: UploadView[];
  preparing: number;
}

export function useStagedAlbum(conversationId: ConvId): StagedAlbum {
  const uploads = useChatMediaStore((state) => state.uploads);
  const flags = useAlbumFlags();
  const preparing = useChatMediaStore((state) => state.preparing[conversationId] ?? 0);
  const messages = useChatThreadStore((state) => readyMessages(state.threads[conversationId]));
  return useMemo(() => {
    const staged = stagedUploads(conversationId, uploads, messages, flags);
    return { id: staged[0]?.album ?? null, uploads: staged, preparing };
  }, [conversationId, uploads, messages, flags, preparing]);
}
