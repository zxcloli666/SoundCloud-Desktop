import type { UploadView } from '../../../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../../../lib/chat/types';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { useChatMediaStore } from '../../../../stores/chat/media';

function latest(uploads: UploadView[], conversationId: ConvId | null): UploadView | null {
  if (!conversationId) return null;
  let found: UploadView | null = null;
  for (const upload of uploads) {
    if (upload.kind !== 'backdrop' || upload.conversationId !== conversationId) continue;
    if (!found || upload.updatedAt > found.updatedAt) found = upload;
  }
  return found;
}

export function useBackdropUpload(conversationId: ConvId | null): {
  upload: UploadView | null;
  error: ChatError | null;
} {
  const upload = useChatMediaStore((state) => latest(state.uploads, conversationId));
  const error = useBackdropStore((state) => (upload ? (state.failures[upload.id] ?? null) : null));
  return { upload, error };
}
