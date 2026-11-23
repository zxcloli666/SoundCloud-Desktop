import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListX, X } from '../../../lib/icons';
import { usePlayerStore } from '../../../stores/player';
import { clearQueueWithUndo } from './clear-queue';
import { HeaderNow } from './HeaderNow';
import { HeroProgress } from './HeroProgress';

const MINUTE = 60_000;

export function queueTime(t: TFunction, ms: number): string {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) return t('queue.minutes', { count: minutes });
  return t('queue.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

function QueueTitle() {
  const { t } = useTranslation();
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const { count, ms } = useMemo(() => {
    const upcoming = queue.slice(Math.max(0, queueIndex + 1));
    return {
      count: upcoming.length,
      ms: upcoming.reduce((sum, track) => sum + (track.duration || 0), 0),
    };
  }, [queue, queueIndex]);
  return (
    <span className="flex h-full min-w-0 items-center gap-2.5">
      <h2 className="shrink-0 text-[18px] font-bold tracking-[-0.022em] text-ink">
        {t('player.queue')}
      </h2>
      {count > 0 && (
        <span className="truncate text-[12px] text-ink-40">
          {t('queue.summary', { count, time: queueTime(t, ms) })}
        </span>
      )}
    </span>
  );
}

const LAYER =
  'absolute inset-0 transition-[opacity,transform] duration-300 ease-[var(--ease-apple)]';

interface Props {
  compact: boolean;
  onClose: () => void;
  onTop: () => void;
}

export function QueueHeader({ compact, onClose, onTop }: Props) {
  const { t } = useTranslation();
  const empty = usePlayerStore((s) => s.queue.length === 0);
  return (
    <header className="relative flex h-[64px] shrink-0 items-center gap-2 pr-3 pl-5">
      <div className="relative h-full min-w-0 flex-1">
        <div
          className={`${LAYER} ${compact ? 'pointer-events-none -translate-y-2 opacity-0' : ''}`}
          inert={compact || undefined}
        >
          <QueueTitle />
        </div>
        <div
          className={`${LAYER} py-2.5 ${compact ? '' : 'pointer-events-none translate-y-2 opacity-0'}`}
          inert={!compact || undefined}
        >
          <HeaderNow onTop={onTop} />
        </div>
      </div>
      <button
        type="button"
        data-ui="queue-clear"
        disabled={empty}
        aria-label={t('player.clearQueue')}
        title={t('player.clearQueue')}
        onClick={clearQueueWithUndo}
        className="shell-btn"
      >
        <ListX size={16} />
      </button>
      <button
        type="button"
        data-ui="queue-close"
        aria-label={t('common.close')}
        title={t('common.close')}
        onClick={onClose}
        className="shell-btn"
      >
        <X size={16} />
      </button>
      <div
        className={`absolute inset-x-0 bottom-0 transition-opacity duration-300 ${compact ? '' : 'opacity-0'}`}
      >
        <HeroProgress thin />
      </div>
    </header>
  );
}
