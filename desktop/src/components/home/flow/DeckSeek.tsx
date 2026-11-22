import { useSyncExternalStore } from 'react';
import { getCurrentTime, getDuration, subscribe } from '../../../lib/audio';
import { formatTime } from '../../../lib/formatters';
import { WaveSeek } from '../../layout/player/WaveSeek';

function Time() {
  const now = useSyncExternalStore(subscribe, () => Math.floor(getCurrentTime()));
  const total = useSyncExternalStore(subscribe, getDuration);
  return (
    <span className="pointer-events-none absolute inset-0 z-[2] grid place-items-center">
      <span className="deck-time flex items-baseline gap-1.5 rounded-[10px] border px-[9px] py-1 text-[clamp(17px,1.1vw,20px)] font-medium tabular-nums tracking-[-0.02em] text-ink">
        {formatTime(now)}
        <span className="text-ink-50">/</span>
        {formatTime(total)}
      </span>
    </span>
  );
}

export function DeckSeek() {
  return (
    <div data-ui="deck-seek" className="col-start-2 min-w-0">
      <WaveSeek capsule>
        <Time />
      </WaveSeek>
    </div>
  );
}
