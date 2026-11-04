import { memo } from 'react';
import type { MyMedia } from '../../../lib/chat/media-types';
import { ImageOff } from './icons';
import { placeholderUrl, thumbUrl } from './thumb-url';

const TILTS = [-9, 5, -3, 8, -6];

export const ThumbFan = memo(function ThumbFan({ items }: { items: MyMedia[] }) {
  const shown = items.slice(0, TILTS.length);
  return (
    <div className="flex h-16 items-center justify-center" aria-hidden>
      {shown.map((item, index) => (
        <span
          key={item.id}
          className="relative -mx-2.5 size-14 overflow-hidden rounded-xl border-2 border-[rgb(var(--surface-hi))] bg-ink/[0.06] shadow-[0_8px_20px_rgb(var(--shade)/calc(0.4*var(--shade-alpha)))]"
          style={{ transform: `rotate(${TILTS[index]}deg)`, zIndex: shown.length - index }}
        >
          {item.status === 'lost' ? (
            <span className="flex size-full items-center justify-center text-ink-35">
              <ImageOff size={16} />
            </span>
          ) : (
            <span
              className="block size-full bg-cover bg-center"
              style={{ backgroundImage: `url("${placeholderUrl(item)}")` }}
            >
              <img
                src={thumbUrl(item)}
                alt=""
                className="size-full object-cover"
                draggable={false}
              />
            </span>
          )}
        </span>
      ))}
    </div>
  );
});
