import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { chatBridge } from '../../../lib/chat/bridge';
import type { BackdropPresetId } from '../../../lib/chat/media-types';
import { art } from '../../../lib/formatters';
import { usePerfMode } from '../../../lib/perf';
import { useScheme } from '../../../lib/scheme';
import { serverTime } from '../../../lib/together/link';
import type { RoomView } from '../../../lib/together/types';
import { ModalTitle } from '../../ui/Modal';
import {
  type ChoiceKey,
  currentKey,
  orderedPresets,
  photoState,
  roomImageSrc,
  uploadStatus,
} from './backdrop/choices';
import { useLeftMs } from './backdrop/countdown';
import { type BackdropProblem, backdropProblem } from './backdrop/errors';
import { useFocusInside } from './backdrop/focus';
import { moveInGrid } from './backdrop/grid';
import { BACKDROP_KEYFRAMES } from './backdrop/keyframes';
import { NoneTile } from './backdrop/NoneTile';
import { PhotoTile } from './backdrop/PhotoTile';
import { PickerFooter } from './backdrop/PickerFooter';
import { type Focus, PickerPreview } from './backdrop/PickerPreview';
import { PresetTile } from './backdrop/PresetTile';
import { useRoomConversation } from './backdrop/shown';
import { useBackdropUpload } from './backdrop/useBackdropUpload';
import { usePhotoActions } from './backdrop/usePhotoActions';
import { presetOf } from './presets';

const PENDING_MS = 8_000;
const FIRST_FOCUS = ['[data-tile][aria-pressed="true"]', '[data-tile]'] as const;

function initialFocus(key: ChoiceKey, imageSrc: string | null): Focus {
  const preset = presetOf(key);
  if (preset) return { kind: 'preset', preset };
  return key === 'photo' ? { kind: 'photo', src: imageSrc } : { kind: 'none' };
}

function usePending(current: ChoiceKey) {
  const [pending, setPending] = useState<ChoiceKey | null>(null);
  const shown = useRef(current);

  useEffect(() => {
    if (shown.current === current) return;
    shown.current = current;
    setPending(null);
  }, [current]);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  return [pending, setPending] as const;
}

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
  const { upload, error } = useBackdropUpload(conversationId);
  const cooldownMs = useLeftMs(room.backdropCooldownUntil);
  const [focus, setFocus] = useState<Focus>(() => initialFocus(current, imageSrc));
  const [pending, setPending] = usePending(current);
  const [problem, setProblem] = useState<BackdropProblem | null>(null);
  const retry = useRef<() => void>(() => {});
  const grid = useRef<HTMLDivElement>(null);
  useFocusInside(grid, FIRST_FOCUS);

  const loading = room.perks === undefined;
  const linking = !conversationId;
  const locked = !loading && (room.perks?.starHost !== true || problem?.fix === 'star');
  const ready = !loading && !linking && !locked;
  const status = uploadStatus(upload, error);
  const photo = photoState(status, imageSrc, cooldownMs);
  const failed = status?.kind === 'failed';
  const uploadProblem = useMemo(
    () => (failed ? backdropProblem(error, serverTime()) : null),
    [failed, error],
  );
  const photos = usePhotoActions(room.code, conversationId, upload, ready, setProblem);

  const choose = useCallback(
    async (key: ChoiceKey, preset: BackdropPresetId | null) => {
      if (!ready || !conversationId || key === current) return;
      retry.current = () => void choose(key, preset);
      setProblem(null);
      setPending(key);
      try {
        await chatBridge.roomBackdrop(room.code, conversationId, preset);
      } catch (failure) {
        setPending(null);
        setProblem(backdropProblem(failure, serverTime()));
      }
    },
    [ready, conversationId, current, room.code, setPending],
  );

  const onPhoto = useCallback(() => {
    setFocus({ kind: 'photo', src: imageSrc });
    if (!ready) return;
    retry.current = () => void photos.pick();
    if (photo.kind === 'failed') void photos.retry();
    else if (photo.kind === 'idle' || photo.kind === 'current') void photos.pick();
  }, [imageSrc, ready, photo.kind, photos]);

  const onRetry = useCallback(() => {
    if (!problem && uploadProblem) void photos.retry();
    else retry.current();
  }, [problem, uploadProblem, photos]);

  const track = room.playback.track;
  const cover = track ? art(track.artwork_url || track.user?.avatar_url, 't200x200') : null;

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-6">
      <style>{BACKDROP_KEYFRAMES}</style>
      <ModalTitle>{t('chat.backdrop.title')}</ModalTitle>
      <PickerPreview
        focus={focus}
        cover={cover}
        title={room.title || room.code}
        listeners={room.members.length}
      />
      <div
        ref={grid}
        role="group"
        aria-label={t('chat.backdrop.title')}
        aria-busy={loading || linking}
        onKeyDown={moveInGrid}
        className="grid grid-cols-4 gap-2"
      >
        <NoneTile
          cover={cover}
          current={current === 'none'}
          pending={pending === 'none'}
          disabled={loading || linking}
          onPick={() => void choose('none', null)}
          onFocus={() => setFocus({ kind: 'none' })}
        />
        <PhotoTile
          state={photo}
          current={current === 'photo'}
          waiting={loading || linking}
          onPick={onPhoto}
          onFocus={() => setFocus({ kind: 'photo', src: imageSrc })}
        />
        {orderedPresets(scheme).map((preset) => (
          <PresetTile
            key={preset.id}
            preset={preset}
            live={live}
            current={current === preset.id}
            pending={pending === preset.id}
            disabled={loading || linking}
            onPick={() => {
              setFocus({ kind: 'preset', preset });
              void choose(preset.id, preset.id);
            }}
            onFocus={() => setFocus({ kind: 'preset', preset })}
          />
        ))}
      </div>
      <PickerFooter
        locked={locked}
        waiting={loading || linking}
        problem={problem ?? uploadProblem}
        uploading={photo.kind === 'uploading' ? photo.upload : null}
        onRetry={onRetry}
        onPhoto={() => void photos.replace()}
        onStorage={() => {
          onClose();
          navigate('/chats/storage');
        }}
        onDrop={
          !problem && (uploadProblem || photo.kind === 'uploading')
            ? () => void photos.drop()
            : null
        }
        onStar={onClose}
      />
    </div>
  );
});
