import { memo } from 'react';
import { hideOnError } from '../../../lib/chat/media-url';

export const BlurImage = memo(function BlurImage({
  src,
  covered,
  holdMs = 0,
  zoom = 'scale-110',
}: {
  src: string;
  covered: boolean;
  holdMs?: number;
  zoom?: string;
}) {
  return (
    <img
      key={src}
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      onError={hideOnError}
      className={`absolute inset-0 size-full object-cover ${zoom}`}
      style={{
        visibility: covered ? 'hidden' : 'visible',
        transition: holdMs > 0 ? `visibility 0s linear ${holdMs}ms` : undefined,
      }}
    />
  );
});
