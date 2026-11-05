import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { serverTime } from '../../../../lib/together/link';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { type BackdropProblem, backdropProblem } from './errors';
import { pickBackdropPath, uploadBackdrop } from './upload';

export interface PhotoActions {
  pick: () => Promise<void>;
  retry: () => Promise<void>;
  replace: () => Promise<void>;
  drop: () => Promise<void>;
}

export function usePhotoActions(
  code: string,
  conversationId: ConvId | null,
  upload: UploadView | null,
  allowed: boolean,
  report: (problem: BackdropProblem | null) => void,
): PhotoActions {
  const { t } = useTranslation();

  const fail = useCallback(
    (failure: unknown) => report(backdropProblem(failure, serverTime())),
    [report],
  );

  const pick = useCallback(async () => {
    if (!allowed || !conversationId) return;
    report(null);
    try {
      const path = await pickBackdropPath(t('chat.backdrop.images'));
      if (!path) return;
      const view = await uploadBackdrop(code, conversationId, path);
      useBackdropStore.getState().started(conversationId, view.id);
      useChatMediaStore.getState().applyUploads({ uploads: [view], removed: [] });
    } catch (failure) {
      fail(failure);
    }
  }, [allowed, conversationId, code, t, report, fail]);

  const drop = useCallback(async () => {
    if (conversationId) useBackdropStore.getState().dismiss(conversationId);
    if (!upload || upload.state === 'committed') return;
    await useChatMediaStore.getState().cancelUpload(upload.id).catch(fail);
  }, [conversationId, upload, fail]);

  const retry = useCallback(async () => {
    if (upload?.state !== 'failed') return pick();
    report(null);
    useBackdropStore.getState().recovered(upload.id);
    await useChatMediaStore.getState().retryUpload(upload.id).catch(fail);
  }, [upload, pick, report, fail]);

  const replace = useCallback(async () => {
    await drop();
    await pick();
  }, [drop, pick]);

  return useMemo(() => ({ pick, retry, replace, drop }), [pick, retry, replace, drop]);
}
