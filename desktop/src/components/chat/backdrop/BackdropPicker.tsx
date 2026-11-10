import {
  type KeyboardEvent,
  type MouseEvent,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { BackdropPresetId } from '../../../lib/chat/media-types';
import { usePerfMode } from '../../../lib/perf';
import { useScheme } from '../../../lib/scheme';
import { serverTime } from '../../../lib/together/link';
import { selectLimitedUntil, useBackdropStore } from '../../../stores/chat/backdrop';
import { ModalTitle } from '../../ui/Modal';
import { ChoiceGrid } from './ChoiceGrid';
import { type ChoiceKey, currentKey, imageSrcOf } from './choices';
import { useLeftMs } from './countdown';
import {
  type BackdropProblem,
  backdropProblem,
  LIMIT_PAUSE_MS,
  limitProblem,
  storedProblem,
} from './errors';
import { useFocusInside } from './focus';
import { BACKDROP_KEYFRAMES } from './keyframes';
import { type Lock, PickerFooter } from './PickerFooter';
import { type Focus, PickerPreview } from './PickerPreview';
import { initialFocus, usePending } from './pending';
import { imageGate, photoState, photoWaitUntil, uploadStatus } from './photo-state';
import { SheetTitle, StoredSheet } from './StoredSheet';
import { type BackdropTarget, locksAll } from './target';
import { uploadPercent } from './upload';
import { useBackdropUpload } from './useBackdropUpload';
import { usePhotoActions } from './usePhotoActions';
import { useStoredSheet } from './useStoredSheet';

const FIRST_FOCUS = ['[data-tile][aria-pressed="true"]', '[data-tile]'] as const;
const SHEET_FOCUS = ['[data-stored-back]'] as const;

function lockOf(target: BackdropTarget, refused: BackdropProblem | null): Lock | null {
  if (target.access === 'role' || refused?.fix === 'role') return 'role';
  if (target.access === 'pending') return 'pending';
  if (target.access === 'star' || refused?.fix === 'star') return 'star';
  return null;
}

export const BackdropPicker = memo(function BackdropPicker({
  target,
  onClose,
}: {
  target: BackdropTarget;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const live = usePerfMode().idleAnim;
  const { conversationId, backdrop } = target;
  const current = currentKey(backdrop);
  const imageSrc = imageSrcOf(backdrop, conversationId);
  const { upload, error, fetching, failure } = useBackdropUpload(conversationId);
  const [focus, setFocus] = useState<Focus>(() => initialFocus(current, imageSrc));
  const [pending, setPending] = usePending(current);
  const [problem, setProblem] = useState<BackdropProblem | null>(null);
  const retry = useRef<() => void>(() => {});
  const top = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const limitedUntil = useBackdropStore(selectLimitedUntil(conversationId));
  const limitedMs = useLeftMs(limitedUntil);
  const limited = limitedMs > 0;

  const waiting = target.access === 'loading' || !conversationId;
  const lock = waiting ? null : lockOf(target, problem);
  const closed = lock !== null && (locksAll(lock) || !target.freePresets);
  const presets = !waiting && !closed && !limited;
  const ready = presets && lock === null;
  const status = useMemo(() => uploadStatus(upload, error, fetching), [upload, error, fetching]);
  const failed = status?.kind === 'failed';
  const uploadProblem = useMemo(
    () => (failed ? backdropProblem(error, serverTime()) : null),
    [failed, error],
  );
  const storedFailure = useMemo(
    () => (failure ? storedProblem(failure.error, serverTime()) : null),
    [failure],
  );
  const limit = useMemo(
    () => (limited && limitedUntil ? limitProblem(limitedUntil) : null),
    [limited, limitedUntil],
  );
  const shownProblem = limit ?? problem ?? storedFailure ?? uploadProblem;
  const cooldownMs = useLeftMs(
    photoWaitUntil(target.cooldownUntil, uploadProblem ?? storedFailure),
  );
  const photo = useMemo(
    () => photoState(status, imageSrc, cooldownMs),
    [status, imageSrc, cooldownMs],
  );
  const gate = useMemo(() => imageGate(photo, waiting, ready), [photo, waiting, ready]);

  const refuse = useCallback(
    (found: BackdropProblem | null) => {
      if (found?.code === 'request_limit' && conversationId) {
        useBackdropStore
          .getState()
          .limit(conversationId, found.until ?? serverTime() + LIMIT_PAUSE_MS);
        return setProblem(null);
      }
      setProblem(found);
    },
    [conversationId],
  );

  const photos = usePhotoActions(target, upload, ready, refuse);
  const imageId = backdrop?.kind === 'image' ? backdrop.mediaId : null;
  const set = target.set;

  const choose = useCallback(
    async (key: ChoiceKey, preset: BackdropPresetId | null) => {
      if (!presets || !conversationId || key === current) return;
      retry.current = () => void choose(key, preset);
      setProblem(null);
      setPending(key);
      useBackdropStore.getState().forgetFetch(conversationId);
      try {
        await set(preset);
      } catch (refused) {
        setPending(null);
        refuse(backdropProblem(refused, serverTime()));
      }
    },
    [presets, conversationId, current, set, setPending, refuse],
  );

  const onChoose = useCallback(
    (key: ChoiceKey, preset: BackdropPresetId | null) => void choose(key, preset),
    [choose],
  );

  const onPhoto = useCallback(() => {
    setFocus({ kind: 'photo', src: imageSrc });
    if (!gate.acts) return;
    retry.current = () => void photos.pick();
    if (photo.kind === 'failed') void photos.retry();
    else void photos.pick();
  }, [imageSrc, gate.acts, photo.kind, photos]);

  const stored = useStoredSheet(grid, gate.acts, photos, onPhoto, setFocus);
  useFocusInside(top, stored.shown ? SHEET_FOCUS : FIRST_FOCUS);

  const onRetry = useCallback(() => {
    if (problem) retry.current();
    else if (failure) stored.pick(failure.source);
    else if (uploadProblem) void photos.retry();
  }, [problem, failure, uploadProblem, stored.pick, photos]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!stored.shown || event.key !== 'Escape') return;
    event.stopPropagation();
    stored.back();
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (event.detail > 1) event.stopPropagation();
  };

  return (
    <div
      ref={top}
      data-ui="chat-backdrop-picker"
      data-lock={lock ?? undefined}
      onKeyDown={onKeyDown}
      onClickCapture={onClickCapture}
      className="flex flex-col gap-4 px-6 pt-6 pb-6"
    >
      <style>{BACKDROP_KEYFRAMES}</style>
      {stored.shown ? (
        <SheetTitle onBack={stored.back} />
      ) : (
        <ModalTitle>{t('chat.backdrop.title')}</ModalTitle>
      )}
      <PickerPreview focus={focus} cover={target.cover} title={target.title} count={target.count} />
      {stored.shown && (
        <StoredSheet
          current={imageId}
          onPick={stored.pick}
          onPreview={stored.preview}
          onPhoto={stored.photoInstead}
        />
      )}
      <div className={stored.shown ? 'hidden' : 'flex flex-col gap-4'}>
        <ChoiceGrid
          gridRef={grid}
          scheme={scheme}
          live={live}
          cover={target.cover}
          current={current}
          pending={pending}
          waiting={waiting}
          closed={!waiting && !presets}
          starred={lock === 'star'}
          photo={photo}
          gate={gate}
          imageSrc={imageSrc}
          onChoose={onChoose}
          onPhoto={onPhoto}
          onStored={stored.open}
          onFocus={setFocus}
        />
        <PickerFooter
          lock={lock}
          scene={target.scene}
          waiting={waiting}
          problem={shownProblem}
          uploading={photo.kind === 'uploading' ? uploadPercent(photo.upload) : null}
          onRetry={onRetry}
          onPhoto={() => void photos.replace()}
          onStored={stored.open}
          onStorage={() => {
            onClose();
            navigate('/chats/storage');
          }}
          onDrop={
            !problem && !limit && (storedFailure || uploadProblem || photo.kind === 'uploading')
              ? () => void photos.drop()
              : null
          }
          onStar={onClose}
        />
      </div>
    </div>
  );
});
