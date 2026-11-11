import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../lib/icons';
import { usePremium } from '../../lib/premium-cache';
import type { WaitKind } from '../../lib/sync-wait';
import { StarCta } from '../star-moments/StarCta';
import { HelpLink } from './HelpLink';
import { Lane } from './Lane';
import { StarMark } from './StarMark';
import { SHAPE_OF, type WaitScope } from './scope';
import { useLongWait } from './useLongWait';
import { WaitClock } from './WaitClock';
import './sync-wait.css';

export const WaitStrip = memo(function WaitStrip({
  kind,
  since,
  scope,
  icon,
  title,
  cta = true,
}: {
  kind: WaitKind;
  since: number;
  scope: WaitScope;
  icon: ReactNode;
  title: string;
  cta?: boolean;
}) {
  const { t } = useTranslation();
  const premium = usePremium();
  const { long, from } = useLongWait(kind, since);
  const lane = long && !(premium && kind === 'stalled');

  return (
    <section
      data-ui="sync-wait"
      data-stage={long ? 'long' : 'calm'}
      data-kind={kind}
      className="relative flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[18px] px-4 py-3"
      style={{
        background: 'rgb(var(--ink) / 0.03)',
        boxShadow: 'inset 0 0 0 1px rgb(var(--ink) / 0.06)',
      }}
    >
      {lane && (
        <span
          aria-hidden
          className="sync-wait-fade absolute left-6 right-[40%] top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 70%, white), transparent)',
          }}
        />
      )}
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-ink-55">{icon}</span>
        <h3 className="truncate text-[15px] font-bold tracking-tight text-ink-90">{title}</h3>
        <span className="flex shrink-0 items-center gap-1.5 text-ink-35">
          <Loader2 size={12} className="animate-spin" />
          {long && <WaitClock since={from} className="font-mono text-[12px] tabular-nums" />}
        </span>
      </div>
      {lane && (
        <div className="sync-wait-rise flex min-w-[240px] flex-1 items-center justify-end gap-3">
          <Lane
            kind="star"
            shape={SHAPE_OF[scope]}
            size="sm"
            still={!cta}
            className="min-w-[72px] max-w-[420px] flex-1"
          />
          <span className="flex shrink-0 items-center gap-1.5 text-[10.5px]">
            <StarMark />
            <span className="font-mono text-[11px] font-bold text-accent">
              {t('starMoments.sync.starTime')}
            </span>
          </span>
          {cta && !premium && <StarCta size="sm" />}
        </div>
      )}
      {long && kind === 'stalled' && (
        <span className={lane ? '' : 'ml-auto'}>
          <HelpLink compact />
        </span>
      )}
    </section>
  );
});
