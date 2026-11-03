import type { ReactNode } from 'react';
import { Loader2 } from '../../../lib/icons';

export type DecisionTone = 'yes' | 'no' | 'plain';

const TONE: Record<DecisionTone, string> = {
  yes: 'border-emerald-300/30 bg-emerald-400/90 text-emerald-950 hover:bg-emerald-300',
  no: 'border-rose-400/30 bg-rose-500/12 text-rose-200 hover:bg-rose-500/22',
  plain: 'border-ink/[0.07] bg-ink/[0.05] text-ink-70 hover:bg-ink/[0.1] hover:text-white',
};

const SIZE = {
  lg: 'h-11 rounded-2xl px-4 text-[13.5px] gap-2',
  sm: 'h-8 rounded-xl px-3 text-[12px] gap-1.5',
} as const;

interface DecisionButtonProps {
  tone: DecisionTone;
  size: keyof typeof SIZE;
  icon?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}

export function DecisionButton({
  tone,
  size,
  icon,
  busy = false,
  disabled = false,
  title,
  onClick,
  children,
}: DecisionButtonProps) {
  const off = disabled || busy;
  const button = (
    <button
      type="button"
      disabled={off}
      aria-busy={busy}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center justify-center border font-semibold transition-colors duration-200 ${SIZE[size]} ${TONE[tone]} ${
        off ? 'cursor-not-allowed' : 'cursor-pointer'
      } ${disabled && !busy ? 'pointer-events-none opacity-35 saturate-50' : ''}`}
    >
      {busy ? <Loader2 size={size === 'lg' ? 16 : 13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
  if (!title) return button;
  return (
    <span title={title} className={`inline-flex ${off ? 'cursor-not-allowed' : ''}`}>
      {button}
    </span>
  );
}
