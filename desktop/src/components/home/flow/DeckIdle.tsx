import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Play } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { DECK_COVER_SIZE } from './DeckCover';

function Mosaic({ tracks }: { tracks: Track[] }) {
  const covers = tracks.slice(0, 4).map((track) => ({
    urn: track.urn,
    src: art(track.artwork_url || track.user?.avatar_url, 't300x300'),
  }));
  return (
    <div
      aria-hidden
      data-ui="deck-cover"
      style={{ width: DECK_COVER_SIZE, height: DECK_COVER_SIZE }}
      className="grid shrink-0 grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-[28px] bg-ink/[0.05] p-1.5 ring-1 ring-ink/[0.1] shadow-[0_24px_60px_-18px_rgb(var(--shade)/calc(0.7*var(--shade-alpha)))]"
    >
      {Array.from({ length: 4 }, (_, i) => covers[i]).map((cover, i) => (
        <span
          key={cover?.urn ?? `empty-${i}`}
          className="overflow-hidden rounded-[18px] bg-ink/[0.06]"
        >
          {cover?.src && <img src={cover.src} alt="" className="size-full object-cover" />}
        </span>
      ))}
    </div>
  );
}

export function DeckIdle({
  tracks,
  canPlay,
  onPlay,
}: {
  tracks: Track[];
  canPlay: boolean;
  onPlay: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div data-ui="deck-idle" className="flex w-full flex-col items-center gap-6">
      <Mosaic tracks={tracks} />
      <div className="flex flex-col items-center gap-1.5 text-center">
        <h2 className="text-[40px] font-bold leading-none tracking-[-0.02em] text-ink">
          {t('flowRedesign.idleTitle')}
        </h2>
        <p className="max-w-[360px] text-[14px] text-ink-50">{t('flowRedesign.idleSub')}</p>
      </div>
      <button
        type="button"
        data-ui="deck-start"
        disabled={!canPlay}
        onClick={onPlay}
        className="flex h-14 cursor-pointer items-center gap-3 rounded-full bg-accent px-9 text-[16px] font-semibold text-accent-contrast transition-[filter,transform] hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        <Play size={20} fill="currentColor" strokeWidth={0} aria-hidden />
        {t('flowRedesign.playWave')}
      </button>
    </div>
  );
}
