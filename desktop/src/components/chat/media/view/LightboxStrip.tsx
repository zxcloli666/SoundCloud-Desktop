import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudOff, ImageOff } from './icons';
import type { ViewImage } from './images';
import { useGone } from './media-state';
import { viewUrl } from './urls';

const StripThumb = memo(function StripThumb({
  image,
  active,
  onPick,
}: {
  image: ViewImage;
  active: boolean;
  onPick: () => void;
}) {
  const { t } = useTranslation();
  const gone = useGone(image.mediaId);
  const ref = useRef<HTMLButtonElement>(null);
  const open = t('chat.gallery.tile.open', { n: image.position + 1, total: image.count });
  const Icon = gone === 'deleted' ? ImageOff : CloudOff;

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={
        gone
          ? t('chat.gallery.grid.itemState', { item: open, state: t(`chat.gallery.tile.${gone}`) })
          : open
      }
      aria-current={active ? 'true' : undefined}
      onClick={onPick}
      className={`relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-[9px] bg-ink/[0.08] transition-[opacity,transform] duration-150 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] ${
        active ? 'opacity-100 ring-2 ring-ink/85' : 'opacity-55 hover:opacity-90'
      }`}
    >
      {gone ? (
        <span className="absolute inset-0 flex items-center justify-center text-ink-45">
          <Icon size={16} strokeWidth={1.7} />
        </span>
      ) : (
        <>
          <img
            src={viewUrl(image.conversationId, image.mediaId, 'placeholder')}
            alt=""
            draggable={false}
            className="absolute inset-0 size-full object-cover"
          />
          <img
            src={viewUrl(image.conversationId, image.mediaId, 'thumb')}
            alt=""
            draggable={false}
            loading="lazy"
            className="absolute inset-0 size-full object-cover"
          />
        </>
      )}
    </button>
  );
});

export const LightboxStrip = memo(function LightboxStrip({
  items,
  index,
  onPick,
}: {
  items: ViewImage[];
  index: number;
  onPick: (index: number) => void;
}) {
  const current = items[index];
  if (!current || current.count < 2) return <div className="h-4 shrink-0" />;
  let first = index;
  while (first > 0 && items[first - 1].clientId === current.clientId) first--;
  let last = index;
  while (last < items.length - 1 && items[last + 1].clientId === current.clientId) last++;
  const album = items.slice(first, last + 1);
  return (
    <div className="relative z-10 flex h-[68px] shrink-0 items-center overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex w-max items-center gap-1.5 py-1">
        {album.map((image, offset) => {
          const at = first + offset;
          return (
            <StripThumb
              key={`${image.clientId}:${image.mediaId}`}
              image={image}
              active={at === index}
              onPick={() => onPick(at)}
            />
          );
        })}
      </div>
    </div>
  );
});
