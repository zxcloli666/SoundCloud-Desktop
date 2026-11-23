import React, { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Music, Pause, Play } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useReducedMotion } from '../../../lib/reduced-motion';
import { useArtistLinkItems, useDisplayTitle } from '../../../lib/track-display';
import { type Track, usePlayerStore } from '../../../stores/player';
import { Marquee } from '../../ui/Marquee';
import { ArtistNameLinks } from '../ArtistNameLinks';
import { LikeButton } from '../LikeButton';
import { HeroProgress } from './HeroProgress';

function HeroGlow({ cover, playing }: { cover: string | null; playing: boolean }) {
  const perf = usePerfMode();
  const reduced = useReducedMotion();
  const blur = perf.blur(44);
  const live = playing && perf.idleAnim && !reduced;
  if (!cover || blur === 0) {
    return (
      <div
        aria-hidden
        data-live={live}
        className="queue-hero-glow pointer-events-none absolute -inset-[14%]"
      />
    );
  }
  return (
    <div
      aria-hidden
      data-live={live}
      data-paused={!playing}
      className="queue-hero-shine pointer-events-none absolute inset-x-[4%] top-[9%] -bottom-[5%]"
      style={{ '--q-blur': `${blur}px` } as CSSProperties}
    >
      <img src={cover} alt="" decoding="async" className="size-full rounded-[32px] object-cover" />
    </div>
  );
}

function HeroCover({ track, playing }: { track: Track; playing: boolean }) {
  const { t } = useTranslation();
  const cover = art(track.artwork_url || track.user?.avatar_url, 't500x500');
  return (
    <div className="queue-hero-art relative">
      <HeroGlow cover={cover} playing={playing} />
      <button
        type="button"
        data-paused={!playing}
        aria-label={playing ? t('queue.pause') : t('queue.play')}
        onClick={() => usePlayerStore.getState().togglePlay()}
        className="queue-cover group relative block aspect-square w-full cursor-pointer overflow-hidden bg-ink/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        {cover ? (
          <img src={cover} alt="" decoding="async" className="size-full object-cover" />
        ) : (
          <span className="flex size-full items-center justify-center text-ink-20">
            <Music size={56} />
          </span>
        )}
        <span
          data-scheme="dark"
          className="absolute inset-0 flex items-center justify-center bg-shade-25 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <span className="queue-hero-disc flex items-center justify-center rounded-full bg-shade-45 text-ink ring-1 ring-ink/25">
            {playing ? (
              <Pause size={24} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={24} fill="currentColor" strokeWidth={0} className="ml-1" />
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

function HeroTitle({ track }: { track: Track }) {
  const title = useDisplayTitle(track);
  const links = useArtistLinkItems(track);
  return (
    <div className="queue-hero-title flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <Marquee
          label={title}
          hold
          className="queue-hero-name font-bold leading-[1.2] tracking-[-0.022em] text-ink"
        >
          {title}
        </Marquee>
        <p className="queue-hero-artist mt-1 truncate text-ink-55">
          <ArtistNameLinks items={links} linkClassName="cursor-pointer transition-colors" />
        </p>
      </div>
      <span className="-mr-1.5 shrink-0 [&>button]:opacity-100">
        <LikeButton track={track} />
      </span>
    </div>
  );
}

export const QueueHero = React.memo(function QueueHero({
  sentinelRef,
}: {
  sentinelRef: (node: HTMLElement | null) => void;
}) {
  const track = usePlayerStore((s) => s.currentTrack);
  const playing = usePlayerStore((s) => s.isPlaying);
  if (!track) return null;
  return (
    <section data-ui="queue-hero" className="queue-hero relative">
      <HeroCover track={track} playing={playing} />
      <HeroTitle track={track} />
      <div className="queue-hero-progress">
        <HeroProgress />
      </div>
      <div ref={sentinelRef} className="absolute inset-x-0 bottom-0 h-px" aria-hidden />
    </section>
  );
});
