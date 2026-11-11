import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import type { WaitKind } from '../../lib/sync-wait';
import { StarCta } from '../star-moments/StarCta';
import { HelpLink } from './HelpLink';
import { Lane } from './Lane';
import { StarMark } from './StarMark';
import { SHAPE_OF, type WaitScope } from './scope';
import { WaitChips } from './WaitChips';
import { WaitClock } from './WaitClock';
import './sync-wait.css';

const GLASS =
  'linear-gradient(180deg, rgb(var(--ink) / 0.06), rgb(var(--ink) / 0.012) 58%), rgb(var(--surface) / 0.72)';
const SOLID = 'rgb(var(--surface) / 0.96)';
const SHADOW =
  '0 28px 80px -30px rgb(var(--shade) / calc(0.9 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.07)';
const HAIRLINE =
  'linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 75%, white), transparent)';

export const WaitCard = memo(function WaitCard({
  kind,
  scope,
  since,
  note,
}: {
  kind: WaitKind;
  scope: WaitScope;
  since: number;
  note: string;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const blur = perf.blur(24);
  const shape = SHAPE_OF[scope];

  return (
    <div
      data-ui="sync-wait"
      data-stage="long"
      data-kind={kind}
      className="relative mx-auto w-full max-w-[580px]"
    >
      <div
        aria-hidden
        className="sync-wait-fade absolute inset-0 overflow-hidden rounded-[26px] border border-ink/[0.09]"
        style={{
          background: blur ? GLASS : SOLID,
          backdropFilter: blur ? `blur(${blur}px) saturate(1.5)` : undefined,
          WebkitBackdropFilter: blur ? `blur(${blur}px) saturate(1.5)` : undefined,
          boxShadow: SHADOW,
          contain: 'strict',
          transform: 'translateZ(0)',
        }}
      >
        {perf.bloom && (
          <span
            className="absolute -bottom-24 -left-10 h-56 w-[70%] rounded-full opacity-60"
            style={{
              background: 'radial-gradient(closest-side, var(--color-accent-glow), transparent)',
            }}
          />
        )}
        <span className="absolute inset-x-12 top-0 h-px" style={{ background: HAIRLINE }} />
      </div>

      <div className="sync-wait-rise relative px-6 pb-6 pt-5" style={{ isolation: 'isolate' }}>
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-45">
              <Loader2 size={11} className="animate-spin" />
              {t('starMoments.sync.queued')}
            </div>
            <WaitClock
              since={since}
              className="mt-1.5 block font-mono text-[30px] font-semibold leading-none tracking-tight tabular-nums text-ink-90"
            />
          </div>
          <WaitChips scope={scope} />
        </div>

        <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-2.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-40">
            {t('starMoments.sync.free')}
          </span>
          <Lane kind="free" shape={shape} size="md" />
          <span className="text-right font-mono text-[11px] text-ink-35">
            {t('starMoments.sync.freeTime')}
          </span>
          <StarMark className="text-[10.5px]" />
          <Lane kind="star" shape={shape} size="md" />
          <span className="text-right font-mono text-[11px] font-bold text-accent">
            {t('starMoments.sync.starTime')}
          </span>
        </div>

        <div className="mt-6 flex justify-center">
          <StarCta size="md" />
        </div>

        {kind === 'stalled' && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink/[0.06] pt-4">
            <p className="min-w-[200px] flex-1 text-[12px] leading-snug text-ink-40">{note}</p>
            <HelpLink />
          </div>
        )}
      </div>
    </div>
  );
});
