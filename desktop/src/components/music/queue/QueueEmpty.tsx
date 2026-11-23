import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, Waves } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useReducedMotion } from '../../../lib/reduced-motion';
import { playWave } from './play-wave';

export function QueueEmpty() {
  const { t } = useTranslation();
  const animated = usePerfMode().idleAnim;
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    const ok = await playWave().catch(() => false);
    setBusy(false);
    if (!ok) toast.error(t('queue.waveFailed'));
  };

  return (
    <div
      data-ui="queue-empty"
      className="flex min-h-full flex-col items-center justify-center gap-7 px-10 pb-16 text-center"
    >
      <div className="queue-disc relative size-36 rounded-full" data-live={animated && !reduced} />
      <div>
        <p className="text-[17px] font-bold tracking-[-0.02em] text-ink">
          {t('player.queueEmpty')}
        </p>
        <p className="mx-auto mt-2 max-w-[240px] text-[13px] leading-relaxed text-ink-45">
          {t('player.queueEmptyHint')}
        </p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void start()}
        className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-accent px-6 text-[14px] font-semibold text-accent-contrast transition-[filter,transform] hover:brightness-110 active:scale-[0.97] disabled:cursor-default disabled:opacity-70"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Waves size={16} />}
        {t('flowRedesign.playWave')}
      </button>
    </div>
  );
}
