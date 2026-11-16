import React, { type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { ChevronDown, ChevronUp } from '../../lib/icons';
import { momentShare, subscribeMomentProgress } from '../../lib/moments/channel';
import { getDisplayTitle } from '../../lib/track-display';
import type { Track } from '../../stores/player';
import { MomentCard } from './MomentCard';
import { useMomentWindow } from './use-moment-window';
import { useStageGestures } from './use-stage-gestures';

const RAIL_SPAN = 3;

export function MomentsStage({
  tracks,
  index,
  go,
  toggle,
  listenFull,
  tail,
}: {
  tracks: Track[];
  index: number;
  go: (delta: 1 | -1) => unknown;
  toggle: () => void;
  listenFull: (track: Track) => void;
  tail?: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const lastIndexRef = useRef(index);
  const forward = index >= lastIndexRef.current;
  useEffect(() => {
    lastIndexRef.current = index;
  }, [index]);
  useStageGestures(stageRef, cardRef, go, toggle);

  const track = tracks[index];
  const moment = useMomentWindow(track);
  const next = tracks[index + 1];
  const enter = `${forward ? 'mo-in-up' : 'mo-in-down'} 460ms var(--ease-apple) backwards`;

  return (
    <div
      ref={stageRef}
      data-ui="moments-stage"
      className="relative min-h-0 flex-1 touch-none overflow-hidden"
    >
      {track && moment && (
        <div key={track.urn} className="mo-anim absolute inset-0" style={{ animation: enter }}>
          <div ref={cardRef} className="size-full will-change-transform">
            <MomentCard track={track} moment={moment} onToggle={toggle} onListenFull={listenFull} />
          </div>
        </div>
      )}
      {!track && tail && (
        <div key="tail" className="mo-anim absolute inset-0" style={{ animation: enter }}>
          {tail}
        </div>
      )}
      <MomentRail tracks={tracks} index={index} go={go} tail={!!tail} />
      {next && <NextPeek track={next} onClick={() => go(1)} />}
    </div>
  );
}

const MomentRail = React.memo(function MomentRail({
  tracks,
  index,
  go,
  tail,
}: {
  tracks: Track[];
  index: number;
  go: (delta: 1 | -1) => unknown;
  tail: boolean;
}) {
  const { t } = useTranslation();
  const from = Math.max(0, index - RAIL_SPAN);
  const to = Math.min(tracks.length, index + RAIL_SPAN + 1);
  const btn =
    'flex size-9 cursor-pointer items-center justify-center rounded-full bg-ink/[0.06] text-ink-70 ring-1 ring-ink/[0.08] transition-colors hover:bg-ink/[0.12] hover:text-ink disabled:cursor-default disabled:opacity-30';

  return (
    <nav
      data-ui="moments-rail"
      className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 md:right-6"
    >
      <button
        type="button"
        onClick={() => go(-1)}
        disabled={index === 0}
        title={t('moments.prev')}
        aria-label={t('moments.prev')}
        className={btn}
      >
        <ChevronUp size={17} />
      </button>
      <div className="flex flex-col items-center gap-1.5 py-1">
        {tracks
          .slice(from, to)
          .map((tr, i) =>
            from + i === index ? (
              <LiveSegment key={tr.urn} urn={tr.urn} />
            ) : (
              <span
                key={tr.urn}
                className={`w-[4px] rounded-full ${from + i < index ? 'h-3 bg-ink/40' : 'h-3 bg-ink/15'}`}
              />
            ),
          )}
      </div>
      <button
        type="button"
        onClick={() => go(1)}
        disabled={index >= tracks.length - (tail ? 0 : 1)}
        title={t('moments.next')}
        aria-label={t('moments.next')}
        className={btn}
      >
        <ChevronDown size={17} />
      </button>
    </nav>
  );
});

function LiveSegment({ urn }: { urn: string }) {
  const fillRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const paint = () => {
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${momentShare(urn)})`;
    };
    paint();
    return subscribeMomentProgress(paint);
  }, [urn]);
  return (
    <span className="relative h-10 w-[4px] overflow-hidden rounded-full bg-ink/15">
      <span
        ref={fillRef}
        className="absolute inset-0 origin-top rounded-full will-change-transform"
        style={{
          background: 'var(--color-accent)',
          transform: 'scaleY(0)',
          transition: 'transform 0.12s linear',
        }}
      />
    </span>
  );
}

function NextPeek({ track, onClick }: { track: Track; onClick: () => void }) {
  const { t } = useTranslation();
  const cover = art(track.artwork_url, 't67x67');
  return (
    <button
      type="button"
      onClick={onClick}
      title={t('moments.next')}
      className="absolute bottom-3 left-1/2 z-10 flex max-w-[min(360px,70%)] -translate-x-1/2 cursor-pointer items-center gap-2.5 rounded-full bg-ink/[0.06] py-1.5 pl-1.5 pr-3.5 text-left ring-1 ring-ink/[0.08] transition-colors hover:bg-ink/[0.1]"
    >
      {cover ? (
        <img src={cover} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="size-7 shrink-0 rounded-full bg-ink/[0.08]" />
      )}
      <span className="min-w-0 truncate text-[12px] font-medium text-ink-70">
        {getDisplayTitle(track)}
      </span>
      <ChevronDown size={14} className="shrink-0 text-ink-50" />
    </button>
  );
}
