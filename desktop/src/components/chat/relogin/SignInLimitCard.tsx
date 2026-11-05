import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from '../../../lib/chat/icons';
import { soonTime } from '../../../lib/chat/time';
import type { Millis } from '../../../lib/chat/types';
import { usePerfMode } from '../../../lib/perf';
import { GlassCard } from '../../ui/GlassCard';
import { useNow } from '../devices/useNow';

export const SignInLimitCard = memo(function SignInLimitCard({ opensBy }: { opensBy: Millis }) {
  const { t, i18n } = useTranslation();
  const perf = usePerfMode();
  const now = useNow(60_000);
  const time = soonTime(opensBy, now, i18n.language).replace(/ /g, '\u00a0');

  return (
    <GlassCard
      data-ui="chat-sign-in-limit"
      padding={false}
      className="relative mx-auto w-full max-w-[380px] overflow-hidden"
    >
      {perf.bloom && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-28 w-3/4 -translate-x-1/2"
          style={{
            background:
              'radial-gradient(ellipse, color-mix(in srgb, var(--color-amber-400) 16%, transparent) 0%, transparent 70%)',
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
          <Hourglass size={20} className="text-amber-300" />
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-[14.5px] font-semibold leading-snug text-ink-90">
            {t('chat.relogin.limit.title')}
          </p>
          <p className="text-[12.5px] leading-snug text-ink-60 tabular-nums text-balance">
            {t('chat.relogin.limit.opens', { time })}
          </p>
        </div>
        <div
          role="status"
          className="flex items-center gap-2 rounded-full border border-ink/[0.07] bg-ink/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-ink-55"
        >
          <span
            aria-hidden
            className={`size-1.5 rounded-full bg-amber-300 ${perf.idleAnim ? 'animate-pulse' : ''}`}
          />
          {t('chat.relogin.limit.trying')}
        </div>
      </div>
    </GlassCard>
  );
});
