import { memo } from 'react';
import { CheckCheck } from '../../../lib/chat/icons';
import type { Tick } from '../../../lib/chat/render';
import { AlertCircle, Check, Clock } from '../../../lib/icons';
import { useThread } from '../thread/context';

export const Ticks = memo(function Ticks({ tick }: { tick: Tick }) {
  const { t } = useThread();
  const label = t(`chat.thread.tick.${tick}`);
  if (tick === 'failed') {
    return <AlertCircle size={12} aria-label={label} className="shrink-0 text-rose-400" />;
  }
  if (tick === 'pending') return <Clock size={11} aria-label={label} className="shrink-0" />;
  if (tick === 'sent') return <Check size={13} aria-label={label} className="shrink-0" />;
  return (
    <CheckCheck
      size={13}
      aria-label={label}
      className="shrink-0"
      style={tick === 'read' ? { color: 'var(--color-accent-hover)' } : undefined}
    />
  );
});
