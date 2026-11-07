import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { shortDate } from '../../../lib/chat/time';
import { Globe, RotateCcw } from '../../../lib/icons';
import type { PublicGate as Gate } from '../../../stores/chat/public';
import { MicOff } from '../room/icons';
import { clockLeft, useCountdown } from './useCountdown';

function Frame({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'muted' | 'off' | 'failed';
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  const tile =
    tone === 'muted'
      ? 'border-rose-400/20 bg-rose-500/10 text-rose-300'
      : 'border-ink/[0.07] bg-ink/[0.04] text-ink-45';
  return (
    <div
      data-ui="chat-public-gate"
      data-gate={tone}
      className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <span className={`flex size-14 items-center justify-center rounded-[20px] border ${tile}`}>
        {icon}
      </span>
      <span className="max-w-[280px] text-[13.5px] font-semibold leading-snug text-ink-85">
        {title}
      </span>
      {children}
    </div>
  );
}

function Restricted({ until }: { until: number }) {
  const { t, i18n } = useTranslation();
  const left = useCountdown(until);
  return (
    <Frame tone="muted" icon={<MicOff size={22} />} title={t('chat.public.gate.restricted')}>
      <span className="text-[22px] font-bold tabular-nums tracking-tight text-rose-200">
        {clockLeft(left)}
      </span>
      <span className="text-[12px] text-ink-40">
        {t('chat.public.muted.until', { time: shortDate(until, Date.now(), i18n.language) })}
      </span>
    </Frame>
  );
}

export const PublicGateView = memo(function PublicGateView({
  gate,
  onRetry,
}: {
  gate: NonNullable<Gate>;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (gate.kind === 'muted') return <Restricted until={gate.until} />;
  if (gate.kind === 'off') {
    return (
      <Frame tone="off" icon={<Globe size={22} />} title={t('chat.public.gate.off')}>
        <span className="max-w-[260px] text-[12.5px] leading-snug text-ink-45">
          {t('chat.public.gate.offHint')}
        </span>
      </Frame>
    );
  }
  return (
    <Frame tone="failed" icon={<Globe size={22} />} title={t('chat.public.gate.failed')}>
      <button
        type="button"
        onClick={onRetry}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-full bg-ink/[0.07] px-4 text-[12.5px] font-semibold text-ink-80 transition-colors duration-150 hover:bg-ink/[0.12]"
      >
        <RotateCcw size={14} />
        {t('chat.thread.retry')}
      </button>
    </Frame>
  );
});
