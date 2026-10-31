import React, {useEffect, useRef} from 'react';
import {getCurrentTime, getDuration, subscribe} from '../../../lib/audio';
import {art, dur} from '../../../lib/formatters';
import {pauseBlack14, playBlack14} from '../../../lib/icons';
import {useAutoHide} from '../../../lib/useAutoHide';
import {useTrackPlay} from '../../../lib/useTrackPlay';
import type {Track} from '../../../stores/player';
import {sameScdMeta, TrackStatusBadges} from '../TrackStatusBadges';
import {TrackTitleArtist} from '../TrackTitleArtist';

function formatMMSS(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Elapsed / total time readout. DOM-ref updates — zero React re-renders. */
const CurrentTimeDisplay = React.memo(function CurrentTimeDisplay() {
  const tRef = useRef<HTMLSpanElement>(null);
  const dRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const paint = () => {
      if (tRef.current) tRef.current.textContent = formatMMSS(getCurrentTime());
      if (dRef.current) dRef.current.textContent = formatMMSS(getDuration());
    };
    paint();
    return subscribe(paint);
  }, []);

  return (
    <span className="text-[11px] tabular-nums text-ink-50 shrink-0 font-medium">
      <span ref={tRef} style={{ color: 'var(--color-accent)' }}>
        0:00
      </span>
      <span className="text-ink-25 mx-1">/</span>
      <span ref={dRef}>0:00</span>
    </span>
  );
});

interface Props {
  track: Track;
  queue: Track[];
  isCurrent: boolean;
}

/** Cover + title/artist row rendered above the waveform. */
export const WaveTrackHeader = React.memo(
  function WaveTrackHeader({ track, queue, isCurrent }: Props) {
    const { isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const showPlayingOverlay = useAutoHide(isThisPlaying);
    const cover = art(track.artwork_url, 't200x200');

    return (
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={togglePlay}
          className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 ring-1 ring-ink/[0.12] cursor-pointer group shadow-lg"
        >
          {cover ? (
            <img
              src={cover}
              alt={track.title}
              className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-105"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full bg-ink/[0.04]" />
          )}
          <span
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 group-hover:bg-black/35 ${
              showPlayingOverlay ? 'bg-black/35' : 'bg-black/0'
            }`}
          >
            <span
              className={`w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-100 ${
                showPlayingOverlay ? 'scale-100' : 'scale-0'
              }`}
            >
              {isThisPlaying ? pauseBlack14 : playBlack14}
            </span>
          </span>
        </button>

        <TrackTitleArtist track={track} highlight={isCurrent} size="md" />

        <div className="shrink-0">
          <TrackStatusBadges meta={track._scd_meta} />
        </div>

        {isCurrent ? (
          <CurrentTimeDisplay />
        ) : (
          <span className="text-[11px] tabular-nums text-ink-35 shrink-0">
            {dur(track.duration)}
          </span>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.isCurrent === next.isCurrent &&
    prev.track.title === next.track.title &&
    prev.track.enrichment === next.track.enrichment &&
    sameScdMeta(prev.track._scd_meta, next.track._scd_meta),
);
