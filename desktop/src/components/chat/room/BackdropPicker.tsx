import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
import { useChatMediaStore } from '../../../stores/chat/media';
import { ModalTitle } from '../../ui/Modal';
import {
  type ChoiceKey,
  currentKey,
  orderedPresets,
  photoState,
  roomImageSrc,
} from './backdrop/choices';
import { useLeftMs } from './backdrop/countdown';
import { type BackdropProblem, backdropProblem } from './backdrop/errors';
import { moveInGrid } from './backdrop/grid';
import { BACKDROP_KEYFRAMES } from './backdrop/keyframes';
import { NoneTile } from './backdrop/NoneTile';
import { PhotoTile } from './backdrop/PhotoTile';
import { PickerFooter } from './backdrop/PickerFooter';
import { type Focus, PickerPreview } from './backdrop/PickerPreview';
import { PresetTile } from './backdrop/PresetTile';
import { useRoomConversation } from './backdrop/shown';
import { pickBackdropPath, uploadBackdrop } from './backdrop/upload';
import { useBackdropUpload } from './backdrop/useBackdropUpload';
import { presetOf } from './presets';

const PENDING_MS = 8_000;

function initialFocus(key: ChoiceKey, imageSrc: string | null): Focus {
  const preset = presetOf(key);
  if (preset) return { kind: 'preset', preset };
  return key === 'photo' ? { kind: 'photo', src: imageSrc } : { kind: 'none' };
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
  const forget = useBackdropStore((state) => state.forget);
  const [focus, setFocus] = useState<Focus>(() => initialFocus(current, imageSrc));
  const [pending, setPending] = useState<ChoiceKey | null>(null);
  const [problem, setProblem] = useState<BackdropProblem | null>(null);
  const retry = useRef<() => void>(() => {});

  const locked = room.perks?.starHost !== true || problem?.fix === 'star';
  const linking = !conversationId;
  const photo = photoState(upload, error, imageSrc, cooldownMs, Date.now());
  const uploadProblem = photo.kind === 'failed' ? backdropProblem(error, serverTime()) : null;
  const shownProblem = problem ?? uploadProblem;

  useEffect(() => {
    if (pending !== null && pending === current) setPending(null);
  }, [pending, current]);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const choose = useCallback(
    async (key: ChoiceKey, preset: BackdropPresetId | null) => {
      if (locked || !conversationId || key === current) return;
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
    [locked, conversationId, current, room.code],
  );

  const pickPhoto = useCallback(async () => {
    if (locked || !conversationId) return;
    retry.current = () => void pickPhoto();
    setProblem(null);
    try {
      const path = await pickBackdropPath(t('chat.backdrop.images'));
      if (!path) return;
      const view = await uploadBackdrop(room.code, conversationId, path);
      useChatMediaStore.getState().applyUploads({ uploads: [view], removed: [] });
    } catch (failure) {
      setProblem(backdropProblem(failure, serverTime()));
    }
  }, [locked, conversationId, room.code, t]);

  const replacePhoto = useCallback(async () => {
    if (upload?.state === 'failed') {
      forget(upload.id);
      await useChatMediaStore
        .getState()
        .cancelUpload(upload.id)
        .catch(() => {});
    }
    await pickPhoto();
  }, [upload, forget, pickPhoto]);

  const dismissUpload = useCallback(async () => {
    if (!upload) return;
    forget(upload.id);
    await useChatMediaStore
      .getState()
      .cancelUpload(upload.id)
      .catch((failure) => setProblem(backdropProblem(failure, serverTime())));
  }, [upload, forget]);

  const onPhoto = useCallback(() => {
    setFocus({ kind: 'photo', src: imageSrc });
    if (locked) return;
    if (photo.kind === 'failed' && upload) {
      setProblem(null);
      forget(upload.id);
      void useChatMediaStore
        .getState()
        .retryUpload(upload.id)
        .catch((failure) => setProblem(backdropProblem(failure, serverTime())));
      return;
    }
    if (photo.kind === 'idle' || photo.kind === 'current') void pickPhoto();
  }, [imageSrc, locked, photo.kind, upload, forget, pickPhoto]);

  const onRetry = useCallback(() => {
    if (uploadProblem && !problem) onPhoto();
    else retry.current();
  }, [uploadProblem, problem, onPhoto]);

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
        role="group"
        aria-label={t('chat.backdrop.title')}
        onKeyDown={moveInGrid}
        className="grid grid-cols-4 gap-2"
        aria-busy={linking}
      >
        <NoneTile
          cover={cover}
          current={current === 'none'}
          pending={pending === 'none'}
          onPick={() => void choose('none', null)}
          onFocus={() => setFocus({ kind: 'none' })}
        />
        <PhotoTile
          state={photo}
          current={current === 'photo'}
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
        linking={linking}
        problem={shownProblem}
        onRetry={onRetry}
        onPhoto={() => void replacePhoto()}
        onStorage={() => {
          onClose();
          navigate('/chats/storage');
        }}
        onDismiss={uploadProblem && !problem ? () => void dismissUpload() : null}
        onStar={onClose}
      />
    </div>
  );
});
