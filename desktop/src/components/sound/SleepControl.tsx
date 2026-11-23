import { useTranslation } from 'react-i18next';
import { ListEnd, Moon, X } from '../../lib/icons';
import {
  cancelSleepTimer,
  SLEEP_MINUTES,
  startSleepAtTrackEnd,
  startSleepTimer,
} from '../../lib/sleep-timer';
import { useSleepMinutesLeft } from '../../lib/use-sleep-left';
import { useSleepTimerStore } from '../../stores/sleep-timer';
import { chip, LABEL } from './styles';

function Running() {
  const { t } = useTranslation();
  const minutes = useSleepMinutesLeft();
  return (
    <button
      type="button"
      onClick={cancelSleepTimer}
      title={t('sleep.cancel')}
      aria-label={t('sleep.cancel')}
      className="flex h-[22px] cursor-pointer items-center gap-1 rounded-full bg-accent/[0.16] pl-2 pr-1.5 text-[11.5px] font-semibold tabular-nums text-accent outline-none transition-colors hover:bg-accent/25 focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {minutes ? t('sleep.minutes', { count: minutes }) : t('sleep.endOfTrack')}
      <X size={11} />
    </button>
  );
}

export function SleepControl() {
  const { t } = useTranslation();
  const timer = useSleepTimerStore((s) => s.timer);
  return (
    <div data-ui="sound-sleep" className="flex flex-col gap-1.5">
      <div className="flex h-7 items-center gap-2">
        <Moon size={13} className="text-ink-45" aria-hidden />
        <span className={LABEL}>{t('sleep.title')}</span>
        {timer && <Running />}
      </div>
      <div className="flex gap-1">
        {SLEEP_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            title={t('sleep.minutes', { count: minutes })}
            aria-label={t('sleep.minutes', { count: minutes })}
            onClick={() => startSleepTimer(minutes)}
            className={`${chip(false)} min-w-8 px-2`}
          >
            {minutes}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={timer?.kind === 'track'}
          title={t('sleep.endOfTrack')}
          aria-label={t('sleep.endOfTrack')}
          onClick={startSleepAtTrackEnd}
          className={`${chip(timer?.kind === 'track')} min-w-8 px-2`}
        >
          <ListEnd size={13} />
        </button>
      </div>
    </div>
  );
}
