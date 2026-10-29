import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePerfMode } from '../../lib/perf';
import { usePremium } from '../../lib/premium-cache';
import { StarCta } from './StarCta';

/** Free sync is crawling: the STAR lane next to it is already done. */
export const SyncStarHint = memo(function SyncStarHint() {
  const { t } = useTranslation();
  const premium = usePremium();
  const perf = usePerfMode();
  if (premium) return null;

  return (
    <div className="mt-1 flex w-full max-w-[340px] flex-col gap-2.5 rounded-[16px] border border-white/[0.08] bg-white/[0.025] px-4 py-3.5">
      <div className="grid grid-cols-[52px_1fr_auto] items-center gap-x-2.5 gap-y-2 font-mono text-[10.5px]">
        <span className="text-left text-white/40">{t('starMoments.sync.free')}</span>
        <div className="relative h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <span
            className="absolute inset-y-0 left-0 w-1/5 rounded-full bg-white/30"
            style={{
              animation: perf.idleAnim ? 'star-sync-crawl 6s ease-in-out infinite' : undefined,
            }}
          />
        </div>
        <span className="text-white/35">{t('starMoments.sync.freeTime')}</span>

        <span className="text-left text-accent">✦ STAR</span>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <span
            className="block h-full w-full rounded-full"
            style={{
              background: 'var(--color-accent)',
              boxShadow: perf.glow ? '0 0 10px var(--color-accent-glow)' : undefined,
            }}
          />
        </div>
        <span className="text-accent">{t('starMoments.sync.starTime')}</span>
      </div>
      <div className="flex justify-center">
        <StarCta size="sm" />
      </div>
    </div>
  );
});
