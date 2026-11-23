import React from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { AlertCircle, Headphones, ListPlus, Loader2, Pause, Play } from '../../lib/icons';
import type { MomentWindow } from '../../lib/moment';
import { type MomentPhase, useMomentPhase } from '../../lib/moments/channel';
import { usePerfMode } from '../../lib/perf';
import { getArtistLinkItems, getDisplayTitle } from '../../lib/track-display';
import { useAddToPlaylistRequest } from '../../stores/add-to-playlist';
import type { Track } from '../../stores/player';
import { ArtistNameLinks } from '../music/ArtistNameLinks';
import { LikeButton } from '../music/LikeButton';
import { MomentVideo } from '../music/lyrics/TrackVideo';
import { VideoLoadMark } from '../music/lyrics/VideoLoadMark';
import { MomentWave } from './MomentWave';

export const MomentCard = React.memo(function MomentCard({
  track,
  moment,
  onToggle,
  onListenFull,
}: {
  track: Track;
  moment: MomentWindow;
  onToggle: () => void;
  onListenFull: (track: Track) => void;
}) {
  const { t } = useTranslation();
  const phase = useMomentPhase(track.urn);
  const requestPlaylist = useAddToPlaylistRequest((s) => s.request);

  return (
    <article
      data-ui="moment-card"
      className="flex h-full w-full items-center justify-center px-6 pt-4 pb-14 [container-type:size] md:px-16"
    >
      <div className="flex w-full max-w-[1080px] flex-col items-center gap-6 lg:flex-row lg:gap-14">
        <MomentCover track={track} phase={phase} onToggle={onToggle} />

        <div className="flex w-full min-w-0 max-w-[520px] flex-col gap-5 lg:max-w-none lg:flex-1">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-[clamp(22px,3vw,38px)] font-black leading-[1.08] tracking-[-0.02em] text-ink">
              {getDisplayTitle(track)}
            </h2>
            <p className="mt-2 truncate text-[15px] font-medium text-ink-55">
              <ArtistNameLinks
                items={getArtistLinkItems(track)}
                linkClassName="cursor-pointer hover:text-ink-90 transition-colors"
              />
            </p>
          </div>

          <MomentWave track={track} moment={moment} />

          <div className="flex flex-wrap items-center gap-2.5 [&_[data-ui=like-button]]:opacity-100">
            <span className="flex size-11 items-center justify-center rounded-full bg-ink/[0.06] ring-1 ring-ink/[0.08]">
              <LikeButton track={track} />
            </span>
            <button
              type="button"
              onClick={() => requestPlaylist([track.urn])}
              title={t('moments.addToPlaylist')}
              aria-label={t('moments.addToPlaylist')}
              className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-ink/[0.06] text-ink-70 ring-1 ring-ink/[0.08] transition-colors hover:bg-ink/[0.1] hover:text-ink"
            >
              <ListPlus size={17} />
            </button>
            <button
              type="button"
              data-ui="moment-listen-full"
              onClick={() => onListenFull(track)}
              className="flex h-11 cursor-pointer items-center gap-2.5 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-accent-contrast shadow-[0_6px_24px_var(--color-accent-glow),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <Headphones size={16} />
              {phase === 'handed' ? t('moments.inPlayer') : t('moments.listenFull')}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});

function MomentCover({
  track,
  phase,
  onToggle,
}: {
  track: Track;
  phase: MomentPhase;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const cover = art(track.artwork_url, 't500x500');
  const playing = phase === 'playing';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? t('moments.pause') : t('moments.play')}
      className="group relative aspect-square w-[clamp(140px,calc(100cqh-340px),min(80cqw,440px))] shrink-0 cursor-pointer overflow-hidden rounded-[28px] ring-1 ring-ink/[0.1] shadow-[0_30px_80px_rgb(var(--shade)/calc(0.55*var(--shade-alpha)))] lg:w-[min(calc(100cqh-90px),50cqw,540px)]"
    >
      {cover ? (
        <img
          src={cover}
          alt=""
          decoding="async"
          draggable={false}
          className="size-full object-cover"
          style={{
            animation:
              playing && perf.idleAnim ? 'mo-breathe 6s ease-in-out infinite alternate' : undefined,
          }}
        />
      ) : (
        <div className="size-full bg-ink/[0.05]" />
      )}
      <MomentVideo track={track} />
      <span
        data-scheme="dark"
        className={`absolute inset-0 flex items-center justify-center transition-colors duration-300 ${
          playing ? 'bg-black/0 group-hover:bg-black/30' : 'bg-black/35'
        }`}
      >
        <CoverBadge phase={phase} />
      </span>
      {playing && <PlayingBars />}
      <VideoLoadMark host="moments" className="right-4 top-4" />
      {phase === 'handed' && (
        <span
          data-scheme="dark"
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-[11.5px] font-semibold text-ink"
        >
          <Headphones size={13} />
          {t('moments.inPlayer')}
        </span>
      )}
    </button>
  );
}

function CoverBadge({ phase }: { phase: MomentPhase }) {
  const { t } = useTranslation();
  if (phase === 'loading') return <Loader2 size={34} className="animate-spin text-ink-80" />;
  if (phase === 'failed') {
    return (
      <span className="flex flex-col items-center gap-2 text-[13px] font-semibold text-ink-80">
        <AlertCircle size={28} />
        {t('moments.failed')}
      </span>
    );
  }
  const playing = phase === 'playing';
  return (
    <span
      className={`flex size-[72px] items-center justify-center rounded-full bg-white text-black shadow-2xl transition-all duration-200 ${
        playing ? 'scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100' : 'scale-100'
      }`}
    >
      {playing ? (
        <Pause size={28} fill="currentColor" />
      ) : (
        <Play size={28} fill="currentColor" className="ml-1" />
      )}
    </span>
  );
}

function PlayingBars() {
  const perf = usePerfMode();
  if (!perf.idleAnim) return null;
  return (
    <span className="absolute bottom-4 left-4 flex h-5 items-end gap-[3px]" aria-hidden>
      {['-0.3s', '-0.7s', '-0.1s', '-0.5s'].map((delay) => (
        <i
          key={delay}
          className="mo-anim w-[4px] origin-bottom rounded-[2px] bg-white"
          style={{
            height: '100%',
            animation: `mo-eq 0.9s ease-in-out ${delay} infinite alternate`,
          }}
        />
      ))}
    </span>
  );
}
