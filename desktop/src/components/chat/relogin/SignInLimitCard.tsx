import { Fragment, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass, MonitorSmartphone } from '../../../lib/chat/icons';
import { soonTime } from '../../../lib/chat/time';
import type { DeviceLimit, Millis } from '../../../lib/chat/types';
import { ChevronRight } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { GlassCard } from '../../ui/GlassCard';
import { useNow } from '../devices/useNow';
import { DeviceLimit as DeviceSlots } from '../settings/devices/DeviceLimit';

const TITLE = 'text-[14.5px] font-semibold leading-snug text-ink-90 text-balance';
const LINE = 'text-[12.5px] leading-snug text-ink-60 text-balance';

function DailyLines({ opensBy }: { opensBy: Millis }) {
  const { t, i18n } = useTranslation();
  const now = useNow(60_000);
  const time = soonTime(opensBy, now, i18n.language).replace(/ /g, '\u00a0');
  return (
    <div className="flex flex-col gap-1.5">
      <p className={TITLE}>{t('chat.relogin.limit.title')}</p>
      <p className={`${LINE} tabular-nums`}>{t('chat.relogin.limit.opens', { time })}</p>
    </div>
  );
}

const DEVICES_PATH = ['nav.settings', 'chat.settings.title', 'chat.devices.list.title'];

function DevicesPath() {
  const { t } = useTranslation();
  return (
    <p
      data-ui="chat-sign-in-limit-path"
      className="flex flex-wrap items-center justify-center gap-1 text-[12px] font-medium text-ink-75"
    >
      {DEVICES_PATH.map((key, index) => (
        <Fragment key={key}>
          {index > 0 && <ChevronRight size={12} className="text-ink-35" aria-hidden />}
          <span>{t(key)}</span>
        </Fragment>
      ))}
    </p>
  );
}

function CapLines({ devicesMax }: { devicesMax: number }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-2.5">
      <p className={TITLE}>{t('chat.relogin.limit.cap.title', { count: devicesMax })}</p>
      <DeviceSlots used={devicesMax} max={devicesMax} />
      <div className="flex flex-col items-center gap-1.5">
        <p className={LINE}>{t('chat.relogin.limit.cap.remove')}</p>
        <DevicesPath />
      </div>
    </div>
  );
}

export const SignInLimitCard = memo(function SignInLimitCard({ limit }: { limit: DeviceLimit }) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const Icon = limit.kind === 'cap' ? MonitorSmartphone : Hourglass;

  return (
    <GlassCard
      data-ui="chat-sign-in-limit"
      data-kind={limit.kind}
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
          <Icon size={20} className="text-amber-300" />
        </div>
        {limit.kind === 'cap' ? (
          <CapLines devicesMax={limit.devicesMax} />
        ) : (
          <DailyLines opensBy={limit.opensBy} />
        )}
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
