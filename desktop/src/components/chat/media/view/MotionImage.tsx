import { memo, useState } from 'react';
import { hideOnError } from '../../../../lib/chat/media-url';

export const MotionImage = memo(function MotionImage({
  src,
  cover,
}: {
  src: string;
  cover: boolean;
}) {
  const [ready, setReady] = useState(false);
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      onLoad={() => setReady(true)}
      onError={hideOnError}
      className={`chat-media-motion absolute inset-0 size-full ${cover ? 'object-cover' : 'object-contain'}`}
      style={{ opacity: ready ? 1 : 0, transition: 'opacity 200ms ease-out' }}
    />
  );
});
