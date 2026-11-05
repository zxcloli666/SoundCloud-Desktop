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
import { chatBridge } from '../../../lib/chat/bridge';
import type { BackdropPresetId } from '../../../lib/chat/media-types';
import { art } from '../../../lib/formatters';
import { usePerfMode } from '../../../lib/perf';
import { useScheme } from '../../../lib/scheme';
import { serverTime } from '../../../lib/together/link';
import type { RoomView } from '../../../lib/together/types';
import { useBackdropStore } from '../../../stores/chat/backdrop';
import { ModalTitle } from '../../ui/Modal';
import { ChoiceGrid } from './backdrop/ChoiceGrid';
import { type ChoiceKey, currentKey, roomImageSrc } from './backdrop/choices';
import { useLeftMs } from './backdrop/countdown';
import { type BackdropProblem, backdropProblem, storedProblem } from './backdrop/errors';
import { useFocusInside } from './backdrop/focus';
import { BACKDROP_KEYFRAMES } from './backdrop/keyframes';
import { PickerFooter } from './backdrop/PickerFooter';
import { type Focus, PickerPreview } from './backdrop/PickerPreview';
import { initialFocus, usePending } from './backdrop/pending';
import { imageGate, photoState, photoWaitUntil, uploadStatus } from './backdrop/photo-state';
import { SheetTitle, StoredSheet } from './backdrop/StoredSheet';
import { useRoomConversation } from './backdrop/shown';
import { uploadPercent } from './backdrop/upload';
import { useBackdropUpload } from './backdrop/useBackdropUpload';
import { usePhotoActions } from './backdrop/usePhotoActions';
import { useStoredSheet } from './backdrop/useStoredSheet';

const FIRST_FOCUS = ['[data-tile][aria-pressed="true"]', '[data-tile]'] as const;
const SHEET_FOCUS = ['[data-stored-back]'] as const;

export const BackdropPicker = memo(function BackdropPicker({
  room,
  onClose,
}: {
  room: RoomView;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scheme = useScheme();
  const live = usePerfMode().idleAnim;
  const conversationId = useRoomConversation(room);
  const current = currentKey(room);
  const imageSrc = roomImageSrc(room, conversationId);
  const { upload, error, fetching, failure } = useBackdropUpload(conversationId);
  const [focus, setFocus] = useState<Focus>(() => initialFocus(current, imageSrc));
  const [pending, setPending] = usePending(current);
  const [problem, setProblem] = useState<BackdropProblem | null>(null);
  const retry = useRef<() => void>(() => {});
  const top = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  const loading = room.perks === undefined;
  const waiting = loading || !conversationId;
  const locked = !loading && (room.perks?.starHost !== true || problem?.fix === 'star');
  const ready = !waiting && !locked;
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
  const shownProblem = problem ?? storedFailure ?? uploadProblem;
  const cooldownMs = useLeftMs(
    photoWaitUntil(room.backdropCooldownUntil, uploadProblem ?? storedFailure),
  );
  const photo = useMemo(
    () => photoState(status, imageSrc, cooldownMs),
    [status, imageSrc, cooldownMs],
  );
  const gate = useMemo(() => imageGate(photo, waiting, ready), [photo, waiting, ready]);
  const photos = usePhotoActions(room.code, conversationId, upload, ready, setProblem);
  const imageId = room.backdrop?.kind === 'image' ? room.backdrop.mediaId : null;

  const choose = useCallback(
    async (key: ChoiceKey, preset: BackdropPresetId | null) => {
      if (!ready || !conversationId || key === current) return;
      retry.current = () => void choose(key, preset);
      setProblem(null);
      setPending(key);
      useBackdropStore.getState().forgetFetch(conversationId);
      try {
        await chatBridge.roomBackdrop(room.code, conversationId, preset);
      } catch (failure) {
        setPending(null);
        setProblem(backdropProblem(failure, serverTime()));
      }
    },
    [ready, conversationId, current, room.code, setPending],
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

  const track = room.playback.track;
  const cover = track ? art(track.artwork_url || track.user?.avatar_url, 't200x200') : null;

  return (
    <div
      ref={top}
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
      <PickerPreview
        focus={focus}
        cover={cover}
        title={room.title || room.code}
        listeners={room.members.length}
      />
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
          cover={cover}
          current={current}
          pending={pending}
          waiting={waiting}
          photo={photo}
          gate={gate}
          imageSrc={imageSrc}
          onChoose={onChoose}
          onPhoto={onPhoto}
          onStored={stored.open}
          onFocus={setFocus}
        />
        <PickerFooter
          locked={locked}
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
            !problem && (storedFailure || uploadProblem || photo.kind === 'uploading')
              ? () => void photos.drop()
              : null
          }
          onStar={onClose}
        />
      </div>
    </div>
  );
});
