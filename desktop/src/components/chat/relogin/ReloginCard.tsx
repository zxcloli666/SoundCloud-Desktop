import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReloginReason } from '../../../lib/chat/login';
import { Check, RefreshCw, Shield, ShieldAlert } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { GlassCard } from '../../ui/GlassCard';
import { reloginFailure } from './failure';
import { ReloginProgress } from './ReloginProgress';
import { useRelogin } from './useRelogin';

export type { ReloginReason };

export interface ReloginCardProps {
  reason: ReloginReason;
  onDone?: () => void;
}

const LOOK = {
  unbound: {
    Icon: Shield,
    title: 'chat.relogin.unboundTitle',
    glow: 'var(--color-accent-glow)',
    tint: 'text-[var(--color-accent)]',
  },
  bound_other: {
    Icon: ShieldAlert,
    title: 'chat.relogin.boundOtherTitle',
    glow: 'color-mix(in srgb, var(--color-amber-400) 16%, transparent)',
    tint: 'text-amber-300',
  },
} as const;

const PRIMARY =
  'flex items-center justify-center gap-2 w-full h-10 rounded-xl text-[13px] font-semibold cursor-pointer transition-transform duration-200 ease-[var(--ease-apple)] hover:scale-[1.02] active:scale-[0.97]';

export const ReloginCard = memo(function ReloginCard({ reason, onDone }: ReloginCardProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const flow = useRelogin(reason, onDone);
  const look = LOOK[reason];
  const failure = flow.error ? reloginFailure(flow.error, t) : null;
  const hint = flow.browserFailed
    ? t('auth.browserFailed')
    : flow.callbackSlow
      ? t('auth.callbackSlow')
      : null;

  return (
    <GlassCard
      data-ui="chat-relogin"
      padding={false}
      className="relative mx-auto w-full max-w-[380px] overflow-hidden"
    >
      {perf.bloom && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-28 w-3/4 -translate-x-1/2"
          style={{
            background: `radial-gradient(ellipse, ${look.glow} 0%, transparent 70%)`,
            contain: 'strict',
            transform: 'translateZ(0)',
          }}
        />
      )}
      <div
        className="relative flex flex-col items-center gap-4 px-6 py-6 text-center"
        style={{ isolation: 'isolate' }}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl border border-ink/[0.08] bg-ink/[0.04]">
          {flow.done ? (
            <Check size={20} className="text-emerald-400" />
          ) : (
            <look.Icon size={20} className={look.tint} />
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-[14.5px] font-semibold leading-snug text-ink-90">
            {flow.done ? t('chat.relogin.done') : t(look.title)}
          </p>
          {!flow.done && (
            <p className="text-[12px] text-ink-40">{t('chat.relogin.musicStays')}</p>
          )}
        </div>

        {flow.done ? null : flow.isPolling ? (
          <ReloginProgress
            step={flow.step}
            authUrl={flow.authUrl}
            hint={hint}
            onReopen={flow.reopen}
            onCancel={flow.cancel}
          />
        ) : failure ? (
          <div className="flex w-full flex-col items-center gap-3">
            <div className="w-full rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
              <p className="text-[12.5px] font-semibold text-ink-85">{failure.title}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-45 break-words">
                {failure.desc}
              </p>
            </div>
            <button
              type="button"
              onClick={flow.retry}
              className={`${PRIMARY} bg-ink/[0.06] hover:bg-ink/[0.1] border border-ink/[0.08] text-ink-80`}
            >
              <RefreshCw size={14} />
              {t('chat.relogin.retry')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void flow.start()}
            className={PRIMARY}
            style={{
              color: 'var(--color-accent-contrast)',
              background: 'linear-gradient(180deg, var(--color-accent), var(--color-accent-hover))',
              boxShadow: '0 10px 30px var(--color-accent-glow)',
            }}
          >
            {t('chat.relogin.confirm')}
          </button>
        )}
      </div>
    </GlassCard>
  );
});
