import { useEffect, useState } from 'react';
import { useSleepTimerStore } from '../stores/sleep-timer';

const minutesLeft = (endsAt: number) => Math.max(1, Math.ceil((endsAt - Date.now()) / 60_000));

export function useSleepMinutesLeft(): number {
  const timer = useSleepTimerStore((s) => s.timer);
  const endsAt = timer?.kind === 'time' ? timer.endsAt : 0;
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setMinutes(0);
      return;
    }
    const sync = () => setMinutes(minutesLeft(endsAt));
    sync();
    const id = window.setInterval(sync, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return minutes;
}
