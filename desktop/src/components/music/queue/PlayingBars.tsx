import { usePerfMode } from '../../../lib/perf';

export function PlayingBars({ live }: { live: boolean }) {
  const animated = usePerfMode().idleAnim;
  return (
    <span className="queue-bars" data-live={live && animated} aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}
