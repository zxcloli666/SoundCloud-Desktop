import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../lib/icons';
import type { OrderStatus } from '../../lib/pay-client';
import { usePerfMode } from '../../lib/perf';

export type PayPhase = 'waiting' | 'granted' | 'failed';

export function phaseOf(status: OrderStatus['status'] | undefined): PayPhase {
  if (status === 'granted') return 'granted';
  if (status === 'failed' || status === 'expired' || status === 'refunded') return 'failed';
  return 'waiting';
}

export const PayStatus = memo(function PayStatus({
  phase,
  failReason,
}: {
  phase: PayPhase;
  failReason?: string;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const spin = perf.idleAnim;

  const ok = phase === 'granted';
  const failed = phase === 'failed';

  return (
    <div
      className="flex items-center gap-3 rounded-[14px] border px-[18px] py-4"
      aria-live="polite"
      style={{
        borderColor: ok
          ? 'color-mix(in srgb, var(--color-accent) 55%, transparent)'
          : failed
            ? 'rgba(255,90,80,0.3)'
            : 'rgba(255,255,255,0.06)',
        background: ok
          ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
          : failed
            ? 'rgba(255,80,70,0.05)'
            : 'rgba(255,255,255,0.03)',
      }}
    >
      {ok ? (
        <span
          className="grid size-[22px] shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--color-accent)' }}
        >
          <Check size={13} strokeWidth={3} className="text-accent-contrast" />
        </span>
      ) : failed ? (
        <span
          className="grid size-[22px] shrink-0 place-items-center rounded-full font-bold"
          style={{ background: 'rgba(255,90,80,0.9)', color: '#fff' }}
        >
          ✕
        </span>
      ) : (
        <span
          className={`size-[22px] shrink-0 rounded-full${spin ? ' animate-spin' : ''}`}
          style={{
            border: '2px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
            borderTopColor: 'var(--color-accent)',
          }}
        />
      )}
      <div>
        <div className="text-[14px] font-medium">
          {ok
            ? t('starpass.status.paid')
            : failed
              ? t('starpass.status.failed')
              : t('starpass.status.waiting')}
        </div>
        <div className="font-mono text-[12px] text-white/55">
          {ok
            ? t('starpass.status.activated')
            : failed
              ? (failReason ?? t('starpass.status.failedHint'))
              : t('starpass.status.polling')}
        </div>
      </div>
    </div>
  );
});
