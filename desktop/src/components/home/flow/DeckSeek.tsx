import { useSyncExternalStore } from 'react';
import { getCurrentTime, getDuration, subscribe } from '../../../lib/audio';
import { formatTime } from '../../../lib/formatters';
import { WaveSeek } from '../../layout/player/WaveSeek';

const timeClass = 'w-11 shrink-0 text-[11px] font-medium tabular-nums text-ink-45';

function TimeNow() {
  const seconds = useSyncExternalStore(subscribe, () => Math.floor(getCurrentTime()));
  return <b className={`${timeClass} text-right text-ink-70`}>{formatTime(seconds)}</b>;
}

function TimeTotal() {
  const seconds = useSyncExternalStore(subscribe, getDuration);
  return <span className={timeClass}>{formatTime(seconds)}</span>;
}

export function DeckSeek() {
  return (
    <div data-ui="deck-seek" className="flex w-full max-w-[560px] items-center gap-3">
      <TimeNow />
      <WaveSeek className="h-10!" />
      <TimeTotal />
    </div>
  );
}
