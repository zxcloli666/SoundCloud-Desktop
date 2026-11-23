import { useTranslation } from 'react-i18next';
import { Lock } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { TEASER_HUES } from '../../../releases/ReleasesLocked';
import { StarCta } from '../../../star-moments/StarCta';

const TILES = Array.from(
  { length: 16 },
  (_, i) => TEASER_HUES[i % TEASER_HUES.length] + Math.floor(i / TEASER_HUES.length) * 24,
);

export function ReleaseTeaser() {
  const { t } = useTranslation();
  const blur = usePerfMode().blur(10);

  return (
    <div
      data-ui="shelf-locked"
      className="relative h-[136px] overflow-hidden rounded-[16px] border border-ink/[0.07]"
    >
      <div
        aria-hidden
        className="pointer-events-none flex gap-4 px-3 pt-3 select-none"
        style={{ filter: blur ? `blur(${blur}px)` : undefined, opacity: blur ? 0.75 : 0.3 }}
      >
        {TILES.map((hue, i) => (
          <div key={`tile-${i}`} className="w-[92px] shrink-0">
            <div
              className="aspect-square rounded-[11px]"
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${hue + 50} 60% 38%))`,
              }}
            />
            <div className="mt-2.5 h-2.5 w-3/4 rounded bg-ink/20" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center gap-4 bg-[linear-gradient(90deg,rgb(var(--paper)/0.9)_0%,rgb(var(--paper)/0.72)_42%,rgb(var(--paper)/0.18)_100%)] px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink-70 ring-1 ring-ink/[0.1]">
          <Lock size={16} aria-hidden />
        </span>
        <div className="min-w-0 max-w-[400px]">
          <p className="text-[14px] font-semibold text-ink-90">{t('releases.title')}</p>
          <p className="mt-0.5 text-[12px] leading-snug text-ink-50">{t('releases.lockedWhy')}</p>
        </div>
        <StarCta size="sm" />
      </div>
    </div>
  );
}
