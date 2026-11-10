import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../lib/chat/bridge';
import { chatError } from '../../../lib/chat/errors';
import type { MediaRef, UploadView } from '../../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../../lib/chat/types';
import { serverTime } from '../../../lib/together/link';
import { useBackdropStore } from '../../../stores/chat/backdrop';
import { useChatMediaStore } from '../../../stores/chat/media';
import { type BackdropProblem, backdropProblem, storedProblem } from './errors';
import type { BackdropTarget } from './target';
import { pickBackdropPath } from './upload';

export interface PhotoActions {
  pick: () => Promise<void>;
  pickStored: (source: MediaRef) => Promise<BackdropProblem | null>;
  retry: () => Promise<void>;
  replace: () => Promise<void>;
  drop: () => Promise<void>;
}

function started(conversationId: ConvId, view: UploadView | null) {
  if (!view) return;
  useBackdropStore.getState().started(conversationId, view.id);
  useChatMediaStore.getState().applyUploads({ uploads: [view], removed: [] });
}

const INTERNAL: ChatError = { code: 'internal' };

function stillFetching(conversationId: ConvId, ticket: number) {
  return useBackdropStore.getState().fetching[conversationId] === ticket;
}

export function usePhotoActions(
  target: BackdropTarget,
  upload: UploadView | null,
  allowed: boolean,
  report: (problem: BackdropProblem | null) => void,
): PhotoActions {
  const { t } = useTranslation();
  const { conversationId, upload: send, uploadStored: sendStored } = target;

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
      useBackdropStore.getState().forgetFetch(conversationId);
      started(conversationId, await send(path));
    } catch (failure) {
      fail(failure);
    }
  }, [allowed, conversationId, send, t, report, fail]);

  const pickStored = useCallback(
    async (source: MediaRef) => {
      if (!allowed || !conversationId) return null;
      report(null);
      const ticket = useBackdropStore.getState().fetchStart(conversationId);
      try {
        const view = await sendStored(source);
        if (stillFetching(conversationId, ticket)) started(conversationId, view);
        return null;
      } catch (failure) {
        if (!stillFetching(conversationId, ticket)) return null;
        const error = chatError(failure) ?? INTERNAL;
        useBackdropStore.getState().fetchFailed(conversationId, ticket, { source, error });
        return storedProblem(error, serverTime());
      } finally {
        useBackdropStore.getState().fetchEnd(conversationId, ticket);
      }
    },
    [allowed, conversationId, sendStored, report],
  );

  const drop = useCallback(async () => {
    if (!conversationId) return;
    const backdrop = useBackdropStore.getState();
    const fetching = conversationId in backdrop.fetching;
    backdrop.dismiss(conversationId);
    backdrop.forgetFetch(conversationId);
    if (fetching) {
      await chatBridge.roomBackdropStop(conversationId).catch(fail);
      return;
    }
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

  return useMemo(
    () => ({ pick, pickStored, retry, replace, drop }),
    [pick, pickStored, retry, replace, drop],
  );
}
