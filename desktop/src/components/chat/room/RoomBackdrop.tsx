import { memo, useEffect, useState } from 'react';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type { RoomView } from '../../../lib/together/types';
import { useBackdropStore, watchBackdropUploads } from '../../../stores/chat/backdrop';
import { BackdropStage } from './backdrop/BackdropStage';
import { useRoomBackdrop } from './backdrop/shown';

const RETRY_MS = 30_000;

function useFailed(src: string | null) {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (failed === null) return;
    const timer = setTimeout(() => setFailed(null), RETRY_MS);
    return () => clearTimeout(timer);
  }, [failed]);
  return [failed !== null && failed === src, () => setFailed(src)] as const;
}

export const RoomBackdrop = memo(function RoomBackdrop({ room }: { room: RoomView }) {
  const { shown } = useRoomBackdrop(room);
  const image = shown?.kind === 'image' ? shown : null;
  const src = image ? chatMediaUrl(image.conversationId, image.mediaId, 'image') : null;
  const [failed, fail] = useFailed(src);
  const held = useBackdropStore((state) => state.dialog !== null);

  useEffect(() => {
    watchBackdropUploads();
  }, []);

  if (shown?.kind === 'preset') {
    const { preset } = shown;
    return (
      <BackdropStage
        key={preset.id}
        src={preset.image}
        light={preset.light}
        motion={preset.tone}
        held={held}
      />
    );
  }
  if (!src || failed) return null;
  return (
    <BackdropStage
      key={src}
      src={src}
      placeholder={
        image ? chatMediaUrl(image.conversationId, image.mediaId, 'placeholder') : undefined
      }
      motion={null}
      onFail={fail}
    />
  );
});
