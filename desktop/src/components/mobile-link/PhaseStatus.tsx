import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Check, Clock, ExternalLink, Loader2, TriangleAlert } from '../../lib/icons';
import type { Phase } from '../../lib/mobile-link/flow';
import { TONE_CLASS, type Tone } from './styles';

interface Look {
  tone: Tone;
  icon: ReactNode;
  label: string;
}

const LOOKS: Record<Phase, Look> = {
  starting: {
    tone: 'busy',
    icon: <Loader2 size={20} className="motion-safe:animate-spin" />,
    label: 'mobileLink.phase.starting',
  },
  waiting: {
    tone: 'busy',
    icon: <ExternalLink size={19} />,
    label: 'mobileLink.phase.waiting',
  },
  received: {
    tone: 'busy',
    icon: <Loader2 size={20} className="motion-safe:animate-spin" />,
    label: 'mobileLink.phase.received',
  },
  completed: { tone: 'ok', icon: <Check size={22} />, label: 'mobileLink.phase.completed' },
  mismatch: {
    tone: 'warn',
    icon: <TriangleAlert size={20} />,
    label: 'mobileLink.phase.mismatch',
  },
  failed: { tone: 'bad', icon: <AlertCircle size={20} />, label: 'mobileLink.phase.failed' },
  expired: { tone: 'bad', icon: <Clock size={20} />, label: 'mobileLink.phase.expired' },
};

export function PhaseStatus({ phase, hint }: { phase: Phase; hint?: string }) {
  const { t } = useTranslation();
  const look = LOOKS[phase];
  return (
    <div
      data-ui="mobile-link-status"
      data-tone={look.tone}
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-2.5 text-center"
    >
      <span className="relative flex items-center justify-center w-14 h-14">
        {phase === 'waiting' && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border border-[var(--color-accent)]/40 motion-safe:animate-ping"
          />
        )}
        <span
          className={`relative w-14 h-14 rounded-full border flex items-center justify-center ${TONE_CLASS[look.tone]}`}
        >
          {look.icon}
        </span>
      </span>
      <p className="text-[14px] font-semibold text-ink-85">{t(look.label)}</p>
      {hint && <p className="text-[12px] text-ink-45 leading-snug max-w-[300px]">{hint}</p>}
    </div>
  );
}
