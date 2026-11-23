import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gauge } from '../../../lib/icons';
import type { PerfMode } from '../../../lib/perf';
import { useSettingsStore } from '../../../stores/settings';
import { Card } from '../primitives';
import { SoftwareRenderingRow } from './SoftwareRenderingRow';

const PERF_CARDS: Array<{
  id: PerfMode;
  labelKey: string;
  descKey: string;
  orbBlur: number;
  motes: number;
}> = [
  {
    id: 'light',
    labelKey: 'settings.perfLight',
    descKey: 'settings.perfLightDesc',
    orbBlur: 0,
    motes: 0,
  },
  {
    id: 'medium',
    labelKey: 'settings.perfMedium',
    descKey: 'settings.perfMediumDesc',
    orbBlur: 9,
    motes: 2,
  },
  {
    id: 'beauty',
    labelKey: 'settings.perfBeauty',
    descKey: 'settings.perfBeautyDesc',
    orbBlur: 18,
    motes: 4,
  },
];

const PerfPreview = memo(function PerfPreview({
  orbBlur,
  motes,
}: {
  orbBlur: number;
  motes: number;
}) {
  return (
    <span data-scheme="dark" className="set-tile-art block h-14 bg-paper">
      {orbBlur > 0 && (
        <span
          className="absolute -top-3 -left-2 h-16 w-16 rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--color-accent-glow), transparent 70%)',
            filter: `blur(${orbBlur}px)`,
          }}
        />
      )}
      {Array.from({ length: motes }, (_, i) => (
        <span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-accent"
          style={{ left: `${18 + i * 22}%`, top: `${26 + ((i * 37) % 40)}%` }}
        />
      ))}
      <span
        className="absolute inset-x-3 bottom-2.5 h-3 rounded-[5px] border border-ink/[0.08]"
        style={{ background: orbBlur > 0 ? 'rgb(var(--ink) / 0.06)' : 'rgb(var(--ink) / 0.025)' }}
      />
    </span>
  );
});

export function PerformanceCard() {
  const { t } = useTranslation();
  const perfMode = useSettingsStore((s) => s.perfMode);
  const setPerfMode = useSettingsStore((s) => s.setPerfMode);

  return (
    <Card
      title={t('settings.performance')}
      desc={t('settings.performanceDesc')}
      icon={<Gauge size={17} />}
    >
      <div className="grid grid-cols-3 gap-2.5">
        {PERF_CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            data-active={perfMode === card.id}
            onClick={() => setPerfMode(card.id)}
            className="set-tile"
          >
            <PerfPreview orbBlur={card.orbBlur} motes={card.motes} />
            <span className="set-tile-label pb-0">{t(card.labelKey)}</span>
            <span className="line-clamp-2 px-1.5 pb-1 text-[11.5px] leading-snug text-ink-45">
              {t(card.descKey)}
            </span>
          </button>
        ))}
      </div>
      <SoftwareRenderingRow />
    </Card>
  );
}
