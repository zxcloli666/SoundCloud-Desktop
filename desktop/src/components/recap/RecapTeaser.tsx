import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { type Aura, auraRgba } from '../../lib/aura';
import { ChevronRight } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';

/** Library card that opens the year recap while its window is open. */
export const RecapTeaser = memo(function RecapTeaser({ aura, year }: { aura: Aura; year: number }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  return (
    <Link
      to="/recap"
      className="group relative flex items-center gap-5 overflow-hidden rounded-[1.75rem] p-5 pr-6 transition-transform duration-300 hover:scale-[1.005]"
      style={{
        border: `0.5px solid ${auraRgba(aura, 0.3)}`,
        background: `linear-gradient(120deg, color-mix(in srgb, var(--color-accent) 22%, transparent), ${auraRgba(aura, 0.1)} 45%, rgba(255,255,255,0.015))`,
        boxShadow: perf.glow ? '0 0 60px -10px var(--color-accent-glow)' : undefined,
      }}
    >
      <span
        className="text-[52px] font-black leading-none tracking-[-0.05em] text-white"
        style={{
          fontFamily: 'var(--font-display)',
          textShadow: '0 0 40px var(--color-accent-glow)',
        }}
      >
        {year}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-accent">
          ✦ {t('recap.title', { year })}
        </div>
        <div className="mt-1 text-[14px] font-semibold text-white/85">{t('recap.teaser')}</div>
      </div>
      <ChevronRight
        size={18}
        className="text-white/40 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white/80"
      />
    </Link>
  );
});
