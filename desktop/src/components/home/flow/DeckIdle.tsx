import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Play } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { DeckFrame } from './DeckCover';
import { HEADING_CLASS, STATUS_CLASS } from './DeckHeading';

function Mosaic({ tracks }: { tracks: Track[] }) {
  const covers = tracks.slice(0, 4).map((track) => ({
    urn: track.urn,
    src: art(track.artwork_url || track.user?.avatar_url, 't300x300'),
  }));
  return (
    <div
      aria-hidden
      data-ui="deck-cover"
      className="relative z-[1] grid size-full grid-cols-2 grid-rows-2 gap-1.5 overflow-hidden rounded-[20px] bg-ink/[0.05] p-1.5 ring-1 ring-ink/[0.1] shadow-[0_24px_60px_-18px_rgb(var(--shade)/calc(0.7*var(--shade-alpha)))]"
    >
      {Array.from({ length: 4 }, (_, i) => covers[i]).map((cover, i) => (
        <span
          key={cover?.urn ?? `empty-${i}`}
          className="overflow-hidden rounded-[14px] bg-ink/[0.06]"
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
    <div data-ui="deck-idle" className="flex w-full flex-col items-center">
      <header className="mb-6 flex w-full max-w-[690px] flex-col items-center text-center">
        <p className={STATUS_CLASS}>{t('flowRedesign.idleSub')}</p>
        <h1 className={`${HEADING_CLASS} truncate py-[0.08em]`}>{t('flowRedesign.idleTitle')}</h1>
      </header>
      <DeckFrame track={tracks[0] ?? null}>
        <Mosaic tracks={tracks} />
      </DeckFrame>
      <button
        type="button"
        data-ui="deck-start"
        disabled={!canPlay}
        onClick={onPlay}
        className="mt-[clamp(26px,4.4vh,44px)] flex h-[62px] cursor-pointer items-center gap-3.5 rounded-full border border-(--disc-line) bg-(--disc) pr-7 pl-2 text-[16px] font-semibold text-(--disc-ink) transition-[filter,transform] hover:brightness-115 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
      >
        <span className="flex size-[46px] items-center justify-center rounded-full bg-current/[0.12]">
          <Play size={20} fill="currentColor" strokeWidth={0} className="ml-0.5" aria-hidden />
        </span>
        {t('flowRedesign.playWave')}
      </button>
    </div>
  );
}
