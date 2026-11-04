import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MediaId } from '../../../../lib/chat/media-types';
import { hideOnError } from '../../../../lib/chat/media-url';
import type { ConvId } from '../../../../lib/chat/types';
import { CloudOff, ImageOff, RotateCcw } from './icons';
import { type LoadAttempt, useLoadAttempt } from './load-attempt';
import { type GoneState, useGone } from './media-state';
import { useCalmMotion } from './motion';
import { viewUrl } from './urls';

export interface ThumbState extends LoadAttempt {
  gone: GoneState | null;
}

export function useThumb(mediaId: MediaId): ThumbState {
  const gone = useGone(mediaId);
  const load = useLoadAttempt(gone !== null);
  return { ...load, gone };
}

export function thumbLabelKey(thumb: ThumbState): string | null {
  if (thumb.gone) return `chat.gallery.tile.${thumb.gone}`;
  return thumb.phase === 'failed' ? 'chat.gallery.tile.failed' : null;
}

export const Shimmer = memo(function Shimmer() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <span
        className="chat-media-motion absolute inset-y-0 -left-full w-[200%]"
        style={{
          background:
            'linear-gradient(100deg, transparent 30%, rgb(var(--ink) / 0.09) 50%, transparent 70%)',
          animation: 'chat-media-shimmer 1.6s ease-in-out infinite',
        }}
      />
    </span>
  );
});

export const GoneFace = memo(function GoneFace({
  state,
  compact,
}: {
  state: GoneState;
  compact: boolean;
}) {
  const { t } = useTranslation();
  const Icon = state === 'deleted' ? ImageOff : CloudOff;
  return (
    <span
      data-ui="chat-media-gone"
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-ink/[0.05] px-2 text-center text-ink-40"
      style={{
        backgroundImage:
          'repeating-linear-gradient(135deg, rgb(var(--ink) / 0.035) 0 6px, transparent 6px 12px)',
      }}
    >
      <Icon size={compact ? 16 : 20} strokeWidth={1.7} />
      {!compact && (
        <span className="text-[11.5px] font-medium leading-tight">
          {t(`chat.gallery.tile.${state}`)}
        </span>
      )}
    </span>
  );
});

export const FailedFace = memo(function FailedFace({ compact }: { compact: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      data-scheme="dark"
      className="chat-media-motion absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-paper/55 text-ink-85"
      style={{ animation: 'chat-media-fade 200ms ease-out 250ms both' }}
    >
      <span className="flex size-8 items-center justify-center rounded-full bg-paper/70 ring-1 ring-ink/15">
        <RotateCcw size={15} />
      </span>
      {!compact && (
        <span className="text-[11px] font-semibold leading-tight">
          {t('chat.gallery.tile.retry')}
        </span>
      )}
    </span>
  );
});

export const MediaFace = memo(function MediaFace({
  conversationId,
  mediaId,
  thumb,
  compact,
}: {
  conversationId: ConvId;
  mediaId: MediaId;
  thumb: ThumbState;
  compact: boolean;
}) {
  const calm = useCalmMotion();
  if (thumb.gone) return <GoneFace state={thumb.gone} compact={compact} />;
  return (
    <>
      <span aria-hidden className="absolute inset-0 bg-ink/[0.06]" />
      <img
        src={viewUrl(conversationId, mediaId, 'placeholder')}
        alt=""
        aria-hidden
        draggable={false}
        onError={hideOnError}
        className="absolute inset-0 size-full scale-110 object-cover"
      />
      {thumb.phase === 'loading' && !calm && <Shimmer />}
      <img
        key={thumb.attempt}
        src={viewUrl(conversationId, mediaId, 'thumb', thumb.attempt)}
        alt=""
        draggable={false}
        decoding="async"
        onLoad={thumb.onLoad}
        onError={thumb.onError}
        className="chat-media-motion absolute inset-0 size-full object-cover"
        style={{
          opacity: thumb.phase === 'ready' ? 1 : 0,
          transition: calm ? undefined : 'opacity 280ms ease-out',
        }}
      />
      {thumb.phase === 'failed' && <FailedFace compact={compact} />}
    </>
  );
});
