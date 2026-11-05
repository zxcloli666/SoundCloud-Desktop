import { memo, useEffect, useState } from 'react';
import { onChatEvent } from '../../../lib/chat/events';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type { ConvId } from '../../../lib/chat/types';
import type { RoomView } from '../../../lib/together/types';
import { useBackdropStore, watchBackdropUploads } from '../../../stores/chat/backdrop';
import { useChatMediaStore } from '../../../stores/chat/media';
import { BackdropStage } from './backdrop/BackdropStage';
import { backdropFace, retriesAfter } from './backdrop/retry';
import { useRoomBackdrop } from './backdrop/shown';

function useFace(src: string | null, mediaId: string | null, conversationId: ConvId | null) {
  const [failed, setFailed] = useState<string | null>(null);
  const shown = useChatMediaStore((state) => (mediaId ? state.shown[mediaId] : undefined));
  const face = backdropFace(shown, failed !== null && failed === src);
  const retry = retriesAfter(face);
  useEffect(() => {
    if (retry === null) return;
    const timer = setTimeout(() => setFailed(null), retry);
    const listening = onChatEvent('chat:sync', (event) => {
      if (event.conversations.some((summary) => summary.id === conversationId)) setFailed(null);
    });
    return () => {
      clearTimeout(timer);
      void listening.then((stop) => stop());
    };
  }, [retry, conversationId]);
  return [face, () => setFailed(src)] as const;
}

export const RoomBackdrop = memo(function RoomBackdrop({ room }: { room: RoomView }) {
  const { shown } = useRoomBackdrop(room);
  const image = shown?.kind === 'image' ? shown : null;
  const src = image ? chatMediaUrl(image.conversationId, image.mediaId, 'image') : null;
  const [face, fail] = useFace(src, image?.mediaId ?? null, image?.conversationId ?? null);
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
  if (!src || face !== 'image') return null;
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
