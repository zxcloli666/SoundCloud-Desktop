import { type MouseEvent, memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MyMedia } from '../../../lib/chat/media-types';
import { Check, Clock } from '../../../lib/icons';
import { useFormatSize } from './bytes';
import { ImageOff } from './icons';
import { thumbUrl } from './thumb-url';

const RETRY_MS = 4000;
const RETRIES = 2;

function Unavailable({ text }: { text: string }) {
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/[0.04] px-3 text-center">
      <ImageOff size={20} className="text-ink-35" />
      <span className="text-[11px] font-medium leading-tight text-ink-45">{text}</span>
    </span>
  );
}

function useThumbLoad() {
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (state !== 'failed' || attempt >= RETRIES) return;
    const timer = window.setTimeout(
      () => {
        setAttempt(attempt + 1);
        setState('loading');
      },
      RETRY_MS * (attempt + 1),
    );
    return () => window.clearTimeout(timer);
  }, [state, attempt]);
  return { state, attempt, setState };
}

function Badges({ item }: { item: MyMedia }) {
  const { t } = useTranslation();
  if (item.kind === 'image' && item.status !== 'uploaded') return null;
  return (
    <span
      data-scheme="dark"
      className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-shade-55 px-2 py-0.5 text-[10px] font-semibold text-ink-85"
    >
      {item.status === 'uploaded' && <Clock size={10} />}
      {item.kind !== 'image'
        ? t(`chat.storage.tile.kind.${item.kind}`)
        : t('chat.storage.tile.unsent')}
    </span>
  );
}

export const MediaTile = memo(function MediaTile({
  item,
  index,
  picked,
  selecting,
  reduced,
  onPick,
}: {
  item: MyMedia;
  index: number;
  picked: boolean;
  selecting: boolean;
  reduced: boolean;
  onPick: (id: string, index: number, range: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const format = useFormatSize();
  const { state, attempt, setState } = useThumbLoad();
  const lost = item.status === 'lost';
  const broken = lost || state === 'failed';
  const date = new Date(item.created_at).toLocaleDateString(i18n.resolvedLanguage, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const click = (event: MouseEvent) => {
    event.preventDefault();
    onPick(item.id, index, event.shiftKey);
  };

  return (
    <button
      type="button"
      data-tile={index}
      data-ui="chat-storage-tile"
      aria-pressed={picked}
      aria-label={t('chat.storage.tile.label', { size: format(item.bytes), date })}
      title={date}
      onClick={click}
      className={`group relative block size-full cursor-pointer overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--paper))] ${
        picked ? 'bg-accent/[0.18]' : 'bg-ink/[0.05]'
      }`}
    >
      <span
        className="absolute inset-0 overflow-hidden rounded-2xl storage-motion"
        style={{
          transform: picked ? 'scale(0.88)' : 'scale(1)',
          transition: reduced ? undefined : 'transform 260ms var(--ease-apple)',
        }}
      >
        {item.status === 'lost' ? null : (
          <img
            key={attempt}
            src={thumbUrl(item)}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => setState('ready')}
            onError={() => setState('failed')}
            className="absolute inset-0 size-full object-cover"
            style={{
              opacity: state === 'ready' ? 1 : 0,
              transition: reduced ? undefined : 'opacity 240ms ease',
            }}
          />
        )}
        {state === 'loading' && !lost && <span className="absolute inset-0 skeleton-shimmer" />}
        {broken && (
          <Unavailable
            text={lost ? t('chat.storage.tile.unavailable') : t('chat.storage.tile.failed')}
          />
        )}
        <span
          data-scheme="dark"
          className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-1 px-2 pt-6 pb-1.5 text-[10.5px] font-semibold tabular-nums text-ink-90"
          style={{ background: 'linear-gradient(0deg, rgb(var(--shade) / 0.62), transparent)' }}
        >
          <span>{format(item.bytes)}</span>
          {item.chats > 0 && (
            <span className="truncate text-ink-70">
              {t('chat.storage.tile.chats', { count: item.chats })}
            </span>
          )}
        </span>
        <Badges item={item} />
      </span>
      <span
        aria-hidden
        className={`absolute top-2 left-2 flex size-5 items-center justify-center rounded-full border transition-[opacity,transform,background-color] duration-200 storage-motion ${
          picked
            ? 'border-transparent bg-accent text-accent-contrast opacity-100'
            : `border-ink/40 bg-shade-30 text-transparent ${selecting ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'}`
        }`}
        data-scheme={picked ? undefined : 'dark'}
      >
        <Check size={12} strokeWidth={3} />
      </span>
    </button>
  );
});
