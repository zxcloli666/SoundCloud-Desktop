import type { TFunction } from 'i18next';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../../../lib/chat/types';
import { notifyError } from '../../../../lib/notify';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { failureOf } from './failure';
import { isDone } from './progress';

const APPLY_MS = 15_000;

export interface AvatarWork {
  upload: UploadView | null;
  error: ChatError | undefined;
  applying: boolean;
  cancel: () => Promise<void>;
}

function latestAvatar(uploads: UploadView[], conversationId: ConvId): UploadView | null {
  let latest: UploadView | null = null;
  for (const upload of uploads) {
    if (upload.conversationId !== conversationId || upload.kind !== 'avatar') continue;
    if (!latest || upload.updatedAt > latest.updatedAt) latest = upload;
  }
  return latest;
}

export function useAvatarWork(
  conversationId: ConvId,
  photo: string | null,
  t: TFunction,
): AvatarWork {
  const upload = useChatMediaStore((state) => latestAvatar(state.uploads, conversationId));
  const error = useChatMediaStore((state) => (upload ? state.errors[upload.id] : undefined));
  const [applying, setApplying] = useState<string | null>(null);
  const last = useRef<{ upload: UploadView; error?: ChatError } | null>(null);
  const cancelled = useRef<string | null>(null);

  useEffect(() => {
    if (upload) {
      last.current = { upload, error };
      return;
    }
    const gone = last.current;
    last.current = null;
    if (!gone || cancelled.current === gone.upload.id) return;
    if (gone.error || gone.upload.state === 'failed') {
      notifyError(t('chat.media.avatar.failed'), { description: failureOf(gone.error, t).text });
    } else if (isDone(gone.upload)) {
      setApplying(photo ?? '');
    }
  }, [upload, error, photo, t]);

  useEffect(() => {
    if (applying === null) return;
    if ((photo ?? '') !== applying) {
      setApplying(null);
      return;
    }
    const timer = setTimeout(() => setApplying(null), APPLY_MS);
    return () => clearTimeout(timer);
  }, [applying, photo]);

  const cancel = useCallback(async () => {
    if (!upload) return;
    cancelled.current = upload.id;
    await useChatMediaStore.getState().cancelUpload(upload.id);
  }, [upload]);

  return { upload, error, applying: applying !== null, cancel };
}
