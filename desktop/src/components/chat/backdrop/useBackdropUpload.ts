import type { UploadView } from '../../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../../lib/chat/types';
import { type StoredFailure, useBackdropStore } from '../../../stores/chat/backdrop';
import { useChatMediaStore } from '../../../stores/chat/media';

function latest(uploads: UploadView[], conversationId: ConvId | null): UploadView | null {
  if (!conversationId) return null;
  let found: UploadView | null = null;
  for (const upload of uploads) {
    if (upload.kind !== 'backdrop' || upload.conversationId !== conversationId) continue;
    if (!found || upload.updatedAt > found.updatedAt) found = upload;
  }
  return found;
}

export interface BackdropUpload {
  upload: UploadView | null;
  error: ChatError | null;
  fetching: boolean;
  failure: StoredFailure | null;
}

export function useBackdropUpload(conversationId: ConvId | null): BackdropUpload {
  const upload = useChatMediaStore((state) => latest(state.uploads, conversationId));
  const attempt = useBackdropStore((state) =>
    conversationId ? (state.attempts[conversationId] ?? null) : null,
  );
  const orphan = useBackdropStore((state) => (upload ? (state.orphans[upload.id] ?? null) : null));
  const fetching = useBackdropStore((state) =>
    conversationId ? conversationId in state.fetching : false,
  );
  const failure = useBackdropStore((state) =>
    conversationId ? (state.failures[conversationId] ?? null) : null,
  );
  const own = attempt && (!upload || attempt.id === upload.id);
  return { upload, error: own ? attempt.error : orphan, fetching, failure };
}
