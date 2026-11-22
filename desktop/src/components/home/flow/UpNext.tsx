import { useTranslation } from 'react-i18next';
import { art, dur } from '../../../lib/formatters';
import { ListMusic, pauseWhite12, playWhite12 } from '../../../lib/icons';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import type { PlayerContext } from '../../layout/player/PlayerButtons';

export const UP_NEXT_SLOTS = 5;

interface Entry {
  track: Track;
  start: () => void;
}

function useEntries(waveTracks: Track[]): Entry[] {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.queueIndex);
  const hasCurrent = usePlayerStore((s) => s.currentTrack !== null);
  const playFromQueue = usePlayerStore((s) => s.playFromQueue);
  const play = usePlayerStore((s) => s.play);
  if (hasCurrent) {
    const first = Math.max(0, index + 1);
    return queue
      .slice(first, first + UP_NEXT_SLOTS)
      .map((track, i) => ({ track, start: () => playFromQueue(first + i) }));
  }
  return waveTracks
    .slice(0, UP_NEXT_SLOTS)
    .map((track) => ({ track, start: () => play(track, waveTracks) }));
}

function Row({ entry }: { entry: Entry }) {
  const { track } = entry;
  const playing = usePlayerStore((s) => s.isPlaying && s.currentTrack?.urn === track.urn);
  const cover = art(track.artwork_url || track.user?.avatar_url, 't200x200');
  return (
    <li>
      <button
        type="button"
        data-ui="up-next-row"
        onClick={entry.start}
        className="group flex h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left outline-none transition-colors hover:bg-ink/[0.05] focus-visible:bg-ink/[0.05]"
      >
        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-ink/[0.06] ring-1 ring-ink/[0.08]">
          {cover && (
            <img
              src={cover}
              alt=""
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
          )}
          <span
            data-scheme="dark"
            className="absolute inset-0 flex items-center justify-center bg-black/50 text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            {playing ? pauseWhite12 : playWhite12}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink-90">{track.title}</span>
          <span className="block truncate text-[12px] text-ink-40">{track.user?.username}</span>
        </span>
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-30">
          {dur(track.duration)}
        </span>
      </button>
    </li>
  );
}

export function UpNext({ waveTracks, ctx }: { waveTracks: Track[]; ctx: PlayerContext }) {
  const { t } = useTranslation();
  const entries = useEntries(waveTracks);
  return (
    <aside
      data-ui="up-next"
      aria-label={t('flowRedesign.upNext')}
      className="flex min-w-0 flex-col gap-2"
    >
      <header className="flex h-9 items-center justify-between gap-3 px-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-45">
          {t('flowRedesign.upNext')}
        </h3>
        <button
          type="button"
          data-ui="up-next-queue"
          aria-pressed={ctx.queueOpen}
          onClick={ctx.onQueueToggle}
          className={`flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-[12px] font-medium transition-colors ${
            ctx.queueOpen
              ? 'bg-accent text-accent-contrast'
              : 'text-ink-60 hover:bg-ink/[0.07] hover:text-ink'
          }`}
        >
          <ListMusic size={14} aria-hidden />
          {t('player.queue')}
        </button>
      </header>
      <ul className="flex flex-col" style={{ minHeight: UP_NEXT_SLOTS * 56 }}>
        {entries.map((entry) => (
          <Row key={entry.track.urn} entry={entry} />
        ))}
        {entries.length === 0 && (
          <li className="px-2 py-4 text-[12.5px] text-ink-40">{t('flowRedesign.emptyQueue')}</li>
        )}
      </ul>
    </aside>
  );
}
