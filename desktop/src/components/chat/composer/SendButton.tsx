import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from '../../../lib/chat/icons';
import { ink } from '../../../lib/chat/tone';
import { Check } from '../../../lib/icons';

const RING = 36;
const STROKE = 2.5;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function HoldRing({ share }: { share: number }) {
  return (
    <svg width={RING} height={RING} className="absolute inset-0 -rotate-90" aria-hidden>
      <circle
        cx={RING / 2}
        cy={RING / 2}
        r={RADIUS}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - share)}
        style={{ transition: 'stroke-dashoffset 900ms linear' }}
      />
    </svg>
  );
}

export const SendButton = memo(function SendButton({
  editing,
  disabled,
  hold = null,
  onSend,
}: {
  editing: boolean;
  disabled: boolean;
  hold?: { left: number; total: number } | null;
  onSend: () => void;
}) {
  const { t } = useTranslation();
  const holding = hold !== null && hold.left > 0;
  const label = holding
    ? t('chat.public.slow.wait', { count: hold.left })
    : t(editing ? 'chat.thread.composer.save' : 'chat.thread.composer.send');
  return (
    <button
      type="button"
      data-ui="chat-send"
      data-hold={holding ? '' : undefined}
      aria-label={label}
      title={label}
      disabled={disabled || holding}
      onClick={onSend}
      className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-[transform,opacity,background-color] duration-150 enabled:hover:scale-105 disabled:cursor-default disabled:opacity-35 data-[hold]:opacity-100"
      style={{
        background: disabled || holding ? ink(8) : 'var(--color-accent)',
        color: holding
          ? 'var(--color-accent-hover)'
          : disabled
            ? ink(60)
            : 'var(--color-accent-contrast)',
      }}
    >
      {holding ? (
        <>
          <HoldRing share={hold.left / Math.max(1, hold.total)} />
          <span className="text-[12px] font-bold tabular-nums">{hold.left}</span>
        </>
      ) : editing ? (
        <Check size={17} />
      ) : (
        <Send size={16} className="-translate-x-px translate-y-px" />
      )}
    </button>
  );
});
