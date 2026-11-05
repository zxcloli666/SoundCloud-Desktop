import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { surface } from '../../../lib/chat/tone';
import { ChevronDown, Loader2 } from '../../../lib/icons';
import { dayText } from './Separators';

const JUMP_BOTTOM = 12;

export const JumpButton = memo(function JumpButton({
  count,
  lift,
  onClick,
}: {
  count: number;
  lift: number;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t('chat.thread.toBottom')}
      onClick={onClick}
      className="chat-thread-motion absolute right-4 z-10 flex size-10 cursor-pointer items-center justify-center rounded-full border border-ink/[0.09] text-ink-75 shadow-[0_10px_28px_rgba(0,0,0,0.5)] transition-colors duration-150 hover:text-ink"
      style={{
        bottom: JUMP_BOTTOM + lift,
        background: surface(12),
        animation: 'chat-thread-rise 180ms ease-out',
      }}
    >
      <ChevronDown size={18} />
      {count > 0 && (
        <span
          className="absolute -top-1.5 left-1/2 min-w-[20px] -translate-x-1/2 rounded-full px-1.5 py-px text-center text-[10.5px] font-bold tabular-nums"
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-contrast)' }}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
});

export const FloatingDay = memo(function FloatingDay({ ts }: { ts: number }) {
  const { t, i18n } = useTranslation();
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <span
        className="rounded-full border border-ink/[0.07] px-3 py-1 text-[11px] font-semibold text-ink-70 shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
        style={{ background: surface(10) }}
      >
        {dayText(ts, t, i18n.language)}
      </span>
    </div>
  );
});

export const TopSpinner = memo(function TopSpinner() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
      <span className="flex size-7 items-center justify-center rounded-full bg-shade-40 text-ink-60">
        <Loader2 size={14} className="animate-spin" />
      </span>
    </div>
  );
});
