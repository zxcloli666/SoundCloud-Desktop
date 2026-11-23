import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight } from '../../lib/icons';

export const RecapTeaser = memo(function RecapTeaser({ year }: { year: number }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/recap"
      className="group flex items-center gap-5 rounded-3xl border border-ink/[0.08] bg-ink/[0.025] p-5 pr-6 transition-colors duration-200 hover:border-ink/[0.14] hover:bg-ink/[0.04]"
    >
      <span
        className="text-[44px] leading-none font-black tracking-[-0.05em] text-ink-90 tabular-nums"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {year}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-40">
          {t('recap.title', { year })}
        </div>
        <div className="mt-1 text-[14px] font-semibold text-ink-85">{t('recap.teaser')}</div>
      </div>
      <ChevronRight
        size={18}
        className="shrink-0 text-ink-35 transition-colors group-hover:text-ink-80"
      />
    </Link>
  );
});
