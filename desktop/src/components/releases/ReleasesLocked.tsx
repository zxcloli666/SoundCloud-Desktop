import { useTranslation } from 'react-i18next';
import { Bell, Lock, Sparkles } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { StarCta } from '../star-moments/StarCta';

const HUES = [18, 200, 285, 150, 340];

export function ReleasesLocked() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const blur = perf.blur(14);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-ink/[0.07] bg-ink/[0.025] p-5">
      <div
        aria-hidden
        className="pointer-events-none flex gap-4 select-none"
        style={{ filter: blur ? `blur(${blur}px)` : undefined, opacity: blur ? 0.85 : 0.4 }}
      >
        {HUES.map((hue) => (
          <div key={hue} className="w-[176px] shrink-0">
            <div
              className="aspect-square rounded-[22px]"
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 70% 58%), hsl(${hue + 50} 60% 38%))`,
              }}
            />
            <div className="mt-2.5 h-3 w-3/4 rounded bg-ink/20" />
            <div className="mt-1.5 h-2.5 w-1/2 rounded bg-ink/10" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[linear-gradient(180deg,rgb(var(--paper)/0.35),rgb(var(--paper)/0.78))] px-6 text-center">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
          <Lock size={18} />
        </span>
        <h3 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-ink-92">
          <Sparkles size={16} className="text-accent" />
          {t('releases.title')}
        </h3>
        <p className="flex max-w-[360px] items-center gap-2 text-[12.5px] leading-snug text-ink-60">
          <Bell size={14} className="shrink-0" />
          {t('releases.lockedWhy')}
        </p>
        <StarCta />
      </div>
    </section>
  );
}
