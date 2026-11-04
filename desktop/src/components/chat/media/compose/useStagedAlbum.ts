import { useMemo } from 'react';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { stagedUploads } from './staged';

export interface StagedAlbum {
  id: string | null;
  uploads: UploadView[];
  preparing: number;
}

export function useStagedAlbum(conversationId: ConvId): StagedAlbum {
  const uploads = useChatMediaStore((state) => state.uploads);
  const sending = useChatMediaStore((state) => state.sending);
  const preparing = useChatMediaStore((state) => state.preparing[conversationId] ?? 0);
  const messages = useChatThreadStore((state) => {
    const thread = state.threads[conversationId];
    return thread?.load === 'ready' ? thread.messages : null;
  });
  return useMemo(() => {
    const staged = stagedUploads(conversationId, uploads, messages, sending);
    return { id: staged[0]?.album ?? null, uploads: staged, preparing };
  }, [conversationId, uploads, messages, sending, preparing]);
}
