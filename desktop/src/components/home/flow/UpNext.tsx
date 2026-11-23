import { useTranslation } from 'react-i18next';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { TrackRow } from './TrackRow';

const QUEUE_PREVIEW = 30;
const NARROW_ROWS = 5;
const NARROW_TAIL =
  'pb-6 [mask-image:linear-gradient(#000_calc(100%-30px),transparent)] @min-[1180px]:pb-0 @min-[1180px]:[mask-image:none]';

export interface QueueEntry {
  track: Track;
  start: () => void;
}

export function useUpcoming(): QueueEntry[] {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.queueIndex);
  const playFromQueue = usePlayerStore((s) => s.playFromQueue);
  const first = Math.max(0, index + 1);
  return queue
    .slice(first, first + QUEUE_PREVIEW)
    .map((track, i) => ({ track, start: () => playFromQueue(first + i) }));
}

interface Props {
  id?: string;
  entries: QueueEntry[];
  narrow: boolean;
}

export function UpNext({ id, entries, narrow }: Props) {
  const { t } = useTranslation();
  return (
    <section
      id={id}
      data-ui="up-next"
      aria-label={t('flowRedesign.upNext')}
      className={`w-full min-w-0 flex-col gap-4 ${narrow ? 'flex' : 'hidden @min-[1180px]:flex'}`}
    >
      <h2 className="hidden text-[22px] font-bold tracking-[-0.025em] text-ink @min-[1180px]:block">
        {t('flowRedesign.upNext')}
      </h2>
      <ul
        className={`flex h-[362px] snap-y snap-proximity flex-col gap-2 overflow-y-auto overscroll-contain scrollbar-hide @min-[1180px]:h-auto @min-[1180px]:max-h-[216px] @min-[1180px]:gap-[9px] ${
          entries.length > NARROW_ROWS ? NARROW_TAIL : ''
        }`}
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
