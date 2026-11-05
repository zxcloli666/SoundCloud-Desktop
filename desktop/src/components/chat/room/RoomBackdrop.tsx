import { memo, useEffect, useState } from 'react';
import { onChatEvent } from '../../../lib/chat/events';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type { ConvId } from '../../../lib/chat/types';
import type { RoomView } from '../../../lib/together/types';
import { useBackdropStore, watchBackdropUploads } from '../../../stores/chat/backdrop';
import { BackdropStage } from './backdrop/BackdropStage';
import { useRoomBackdrop } from './backdrop/shown';

const RETRY_MS = 30_000;

function useFailed(src: string | null, conversationId: ConvId | null) {
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (failed === null) return;
    const timer = setTimeout(() => setFailed(null), RETRY_MS);
    const listening = onChatEvent('chat:sync', (event) => {
      if (event.conversations.some((summary) => summary.id === conversationId)) setFailed(null);
    });
    return () => {
      clearTimeout(timer);
      void listening.then((stop) => stop());
    };
  }, [failed, conversationId]);
  return [failed !== null && failed === src, () => setFailed(src)] as const;
}

export const RoomBackdrop = memo(function RoomBackdrop({ room }: { room: RoomView }) {
  const { shown } = useRoomBackdrop(room);
  const image = shown?.kind === 'image' ? shown : null;
  const src = image ? chatMediaUrl(image.conversationId, image.mediaId, 'image') : null;
  const [failed, fail] = useFailed(src, image?.conversationId ?? null);
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
