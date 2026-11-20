import * as Popover from '@radix-ui/react-popover';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListEnd, Moon } from '../../lib/icons';
import {
  cancelSleepTimer,
  SLEEP_MINUTES,
  startSleepAtTrackEnd,
  startSleepTimer,
} from '../../lib/sleep-timer';
import { useSleepTimerStore } from '../../stores/sleep-timer';

const optionClass =
  'flex h-9 cursor-pointer items-center justify-center rounded-xl border border-ink/[0.06] bg-ink/[0.03] text-[12px] font-medium text-ink-70 outline-none transition-colors hover:bg-ink/[0.08] hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/50';

function minutesLeft(endsAt: number) {
  return Math.max(1, Math.ceil((endsAt - Date.now()) / 60_000));
}

const SleepBadge = React.memo(() => {
  const timer = useSleepTimerStore((s) => s.timer);
  const endsAt = timer?.kind === 'time' ? timer.endsAt : 0;
  const [minutes, setMinutes] = useState(() => (endsAt ? minutesLeft(endsAt) : 0));

  useEffect(() => {
    if (!endsAt) return;
    const sync = () => setMinutes(minutesLeft(endsAt));
    sync();
    const id = window.setInterval(sync, 1000);
    return () => window.clearInterval(id);
  }, [endsAt]);

  return (
    <span className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-accent px-[3px] text-[9px] font-semibold leading-none tabular-nums text-accent-contrast">
      {endsAt ? minutes : <ListEnd size={9} />}
    </span>
  );
});

export const SleepTimerButton = React.memo(
  ({ className }: { className: (active: boolean) => string }) => {
    const { t } = useTranslation();
    const active = useSleepTimerStore((s) => s.timer !== null);
    const [open, setOpen] = useState(false);

    const pick = (start: () => void) => () => {
      start();
      setOpen(false);
    };

    return (
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (next && active) cancelSleepTimer();
          else setOpen(next);
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            data-ui="player-sleep"
            title={active ? t('sleep.cancel') : t('sleep.title')}
            aria-label={active ? t('sleep.cancel') : t('sleep.title')}
            className={`relative ${className(active)}`}
          >
            <Moon size={16} />
            {active && <SleepBadge />}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="end"
            sideOffset={10}
            collisionPadding={12}
            className="z-[200] w-[208px] origin-bottom-right rounded-[18px] border border-ink/[0.10] bg-surface/96 p-3 shadow-[0_18px_60px_rgb(var(--shade)/calc(0.55*var(--shade-alpha)))] backdrop-blur-xl outline-none data-[state=open]:animate-fade-in-up"
          >
            <div className="flex items-center gap-2 px-1 pb-2.5 text-ink-65">
              <Moon size={14} />
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                {t('sleep.title')}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {SLEEP_MINUTES.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  className={optionClass}
                  onClick={pick(() => startSleepTimer(minutes))}
                >
                  {t('sleep.minutes', { count: minutes })}
                </button>
              ))}
              <button
                type="button"
                className={`${optionClass} col-span-2 gap-1.5`}
                onClick={pick(startSleepAtTrackEnd)}
              >
                <ListEnd size={14} />
                {t('sleep.endOfTrack')}
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  },
);
