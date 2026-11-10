import { memo, useEffect, useState } from 'react';
import { onChatEvent } from '../../../lib/chat/events';
import type { RoomBackdrop } from '../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type { ConvId } from '../../../lib/chat/types';
import { useBackdropStore, watchBackdropUploads } from '../../../stores/chat/backdrop';
import { useChatMediaStore } from '../../../stores/chat/media';
import { BackdropStage } from './BackdropStage';
import { backdropFace, retriesAfter } from './retry';
import { useBackdropView } from './shown';

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

export const BackdropLayer = memo(function BackdropLayer({
  conversationId,
  backdrop,
}: {
  conversationId: ConvId | null;
  backdrop: RoomBackdrop | null;
}) {
  const { shown } = useBackdropView(conversationId, backdrop);
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
