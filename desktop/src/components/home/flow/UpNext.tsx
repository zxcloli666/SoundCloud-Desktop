import { useTranslation } from 'react-i18next';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { TrackRow } from './TrackRow';

const VISIBLE_ROWS = 3;
const ROW_HEIGHT = 66;
const ROW_GAP = 9;
const QUEUE_PREVIEW = 30;

interface Entry {
  track: Track;
  start: () => void;
}

function useEntries(): Entry[] {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.queueIndex);
  const playFromQueue = usePlayerStore((s) => s.playFromQueue);
  const first = Math.max(0, index + 1);
  return queue
    .slice(first, first + QUEUE_PREVIEW)
    .map((track, i) => ({ track, start: () => playFromQueue(first + i) }));
}

export function UpNext() {
  const { t } = useTranslation();
  const entries = useEntries();
  return (
    <section
      data-ui="up-next"
      aria-label={t('flowRedesign.upNext')}
      className="flex w-full min-w-0 flex-col gap-4"
    >
      <h2 className="text-[22px] font-bold tracking-[-0.025em] text-ink">
        {t('flowRedesign.upNext')}
      </h2>
      <ul
        className="flex snap-y snap-proximity flex-col gap-[9px] overflow-y-auto overscroll-contain scrollbar-hide"
        style={{ maxHeight: VISIBLE_ROWS * ROW_HEIGHT + (VISIBLE_ROWS - 1) * ROW_GAP }}
      >
        {entries.map((entry) => (
          <li key={entry.track.urn} data-ui="up-next-row" className="snap-start">
            <TrackRow track={entry.track} onPlay={entry.start} framed />
          </li>
        ))}
        {entries.length === 0 && (
          <li className="px-1 py-4 text-[12.5px] text-ink-40">{t('flowRedesign.emptyQueue')}</li>
        )}
      </ul>
    </section>
  );
}
