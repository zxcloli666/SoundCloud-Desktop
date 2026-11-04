import { memo, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fitInside, type Size } from './album-layout';
import { CloudOff, ImageOff, LoaderCircle, RotateCcw } from './icons';
import type { ViewImage } from './images';
import { useGone } from './media-state';
import { useCalmMotion } from './motion';
import { viewUrl } from './urls';
import { useZoomPan, type ZoomPan } from './useZoomPan';

type FullPhase = 'loading' | 'ready' | 'failed';

const PAD_X = 72;
const PAD_Y = 24;

function useStageSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setSize({ w: node.clientWidth, h: node.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function GoneCard({ state }: { state: 'deleted' | 'lost' }) {
  const { t } = useTranslation();
  const Icon = state === 'deleted' ? ImageOff : CloudOff;
  return (
    <div className="flex flex-col items-center gap-3 text-center text-ink-55">
      <span className="flex size-16 items-center justify-center rounded-[22px] bg-ink/[0.06] text-ink-45 ring-1 ring-ink/[0.08]">
        <Icon size={26} strokeWidth={1.6} />
      </span>
      <span className="text-[14px] font-semibold text-ink-80">
        {t(`chat.gallery.tile.${state}`)}
      </span>
    </div>
  );
}

function FullStatus({
  phase,
  calm,
  onRetry,
}: {
  phase: FullPhase;
  calm: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (phase === 'ready') return null;
  if (phase === 'failed') {
    return (
      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface/90 py-1.5 pr-1.5 pl-3.5 text-[12px] font-medium text-ink-75 ring-1 ring-ink/10">
        {t('chat.gallery.viewer.failed')}
        <button
          type="button"
          onClick={onRetry}
          className="flex h-7 cursor-pointer items-center gap-1 rounded-full bg-ink/[0.1] px-2.5 text-[12px] font-semibold text-ink-90 transition-colors duration-150 hover:bg-ink/[0.16]"
        >
          <RotateCcw size={12} />
          {t('chat.gallery.viewer.retry')}
        </button>
      </div>
    );
  }
  return (
    <div
      role="status"
      aria-label={t('chat.gallery.viewer.loading')}
      className="chat-media-motion absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-surface/85 px-3 py-1.5 text-[12px] text-ink-60 ring-1 ring-ink/10"
      style={{ animation: 'chat-media-fade 220ms ease-out 350ms both' }}
    >
      <LoaderCircle
        size={13}
        className="chat-media-motion"
        style={{ animation: calm ? undefined : 'chat-media-spin 0.9s linear infinite' }}
      />
      {t('chat.gallery.viewer.loading')}
    </div>
  );
}

export const LightboxStage = memo(function LightboxStage({
  image,
  onZoom,
  onBackdrop,
}: {
  image: ViewImage;
  onZoom: (zoom: ZoomPan) => void;
  onBackdrop: () => void;
}) {
  const calm = useCalmMotion();
  const gone = useGone(image.mediaId);
  const stageRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const stage = useStageSize(stageRef);
  const fit = fitInside(image, Math.max(1, stage.w - PAD_X * 2), Math.max(1, stage.h - PAD_Y * 2));
  const zoom = useZoomPan(stageRef, targetRef, fit, stage, calm);
  const [full, setFull] = useState<{ phase: FullPhase; attempt: number }>({
    phase: 'loading',
    attempt: 0,
  });
  const [thumbShown, setThumbShown] = useState(false);

  useEffect(() => onZoom(zoom), [onZoom, zoom]);

  const { conversationId, mediaId } = image;
  const ready = full.phase === 'ready';

  return (
    <div
      ref={stageRef}
      data-ui="chat-lightbox-stage"
      className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden select-none"
      onClick={(event) => {
        if (event.target === event.currentTarget && zoom.scale <= 1) onBackdrop();
      }}
    >
      {gone ? (
        <GoneCard state={gone} />
      ) : (
        <>
          <div
            className="chat-media-motion relative"
            style={{
              width: fit.w,
              height: fit.h,
              animation: calm ? undefined : 'chat-media-pop 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div
              ref={targetRef}
              className="absolute inset-0 overflow-hidden rounded-[6px] shadow-[0_24px_80px_rgb(var(--shade)/calc(0.6*var(--shade-alpha)))]"
              style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
            >
              <img
                src={viewUrl(conversationId, mediaId, 'placeholder')}
                alt=""
                aria-hidden
                draggable={false}
                className="absolute inset-0 size-full scale-105 object-cover"
                style={{ visibility: thumbShown || ready ? 'hidden' : undefined }}
              />
              <img
                src={viewUrl(conversationId, mediaId, 'thumb')}
                alt=""
                aria-hidden
                draggable={false}
                onLoad={() => setThumbShown(true)}
                className="absolute inset-0 size-full object-cover"
                style={{ visibility: ready ? 'hidden' : undefined }}
              />
              <img
                key={full.attempt}
                src={viewUrl(conversationId, mediaId, 'image', full.attempt)}
                alt=""
                draggable={false}
                decoding="async"
                onLoad={() => setFull((current) => ({ ...current, phase: 'ready' }))}
                onError={() => setFull((current) => ({ ...current, phase: 'failed' }))}
                className="chat-media-motion absolute inset-0 size-full object-cover"
                style={{
                  opacity: ready ? 1 : 0,
                  transition: calm ? undefined : 'opacity 240ms ease-out',
                }}
              />
            </div>
          </div>
          <FullStatus
            phase={full.phase}
            calm={calm}
            onRetry={() =>
              setFull((current) => ({ phase: 'loading', attempt: current.attempt + 1 }))
            }
          />
        </>
      )}
    </div>
  );
});
