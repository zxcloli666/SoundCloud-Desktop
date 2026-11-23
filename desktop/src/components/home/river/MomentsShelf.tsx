import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { startHoverPreview, stopHoverPreview, useIsPreviewActive } from '../../../lib/audioPreview';
import { art, dur } from '../../../lib/formatters';
import { GalleryVerticalEnd } from '../../../lib/icons';
import { trackMoment } from '../../../lib/moment';
import { useMomentsTeaser } from '../../../lib/moments/teaser';
import { useAuthStore } from '../../../stores/auth';
import type { Track } from '../../../stores/player';

const FAN = 5;
const TILT = [-7, -3.5, 0, 3.5, 7];

export function MomentsShelf() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const teaser = useMomentsTeaser(useAuthStore((s) => s.isAuthenticated));
  const tracks = useMemo(
    () => teaser.filter((track) => Boolean(track.user?.avatar_url)).slice(0, FAN),
    [teaser],
  );
  const open = (startUrn?: string) => navigate('/moments', { state: { startUrn } });
  if (tracks.length === 0) return null;

  return (
    <section data-ui="moments-station" className="flex min-w-0 flex-col gap-4">
      <h2 className="text-[21px] font-bold leading-tight tracking-[-0.015em] text-ink-92">
        {t('soundwave.home.cluster.moments')}
      </h2>
      <div className="panel relative overflow-hidden p-5 md:p-6">
        <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
          <div className="flex items-end pl-6" onMouseLeave={stopHoverPreview}>
            {tracks.map((track, i) => (
              <FanTile
                key={track.urn}
                track={track}
                tilt={TILT[i] ?? 0}
                onOpen={() => open(track.urn)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => open()}
            className="flex h-11 shrink-0 cursor-pointer items-center gap-2.5 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-accent-contrast transition-[filter] hover:brightness-110"
          >
            <GalleryVerticalEnd size={16} />
            {t('moments.open')}
          </button>
        </div>
      </div>
    </section>
  );
}

function FanTile({ track, tilt, onOpen }: { track: Track; tilt: number; onOpen: () => void }) {
  const previewing = useIsPreviewActive(track.urn);
  const moment = trackMoment(track);
  const cover = art(track.artwork_url, 't300x300');

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => startHoverPreview(track)}
      className="group relative -ml-6 size-[104px] shrink-0 cursor-pointer transition-transform duration-300 ease-[var(--ease-apple)] hover:z-10 hover:-translate-y-2 md:size-[116px]"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <span
        className={`absolute inset-0 overflow-hidden rounded-2xl shadow-[0_14px_34px_rgb(var(--shade)/calc(0.5*var(--shade-alpha)))] ring-2 transition-[box-shadow] duration-300 ${
          previewing ? 'ring-[var(--color-accent)]' : 'ring-ink/[0.08]'
        }`}
      >
        {cover ? (
          <img src={cover} alt="" className="size-full object-cover" decoding="async" />
        ) : (
          <span className="block size-full bg-ink/[0.06]" />
        )}
      </span>
      {moment && (
        <span
          data-scheme="dark"
          className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-ink"
        >
          {dur(moment.startMs)}
        </span>
      )}
    </button>
  );
}
