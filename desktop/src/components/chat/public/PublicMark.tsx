import { memo } from 'react';
import { Globe } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';

export const PublicMark = memo(function PublicMark({
  size,
  live = false,
}: {
  size: number;
  live?: boolean;
}) {
  const perf = usePerfMode();
  const pulse = live && perf.idleAnim;
  return (
    <span
      data-ui="chat-public-mark"
      className="relative flex shrink-0 items-center justify-center rounded-[32%]"
      style={{
        width: size,
        height: size,
        color: 'var(--color-accent-contrast)',
        background: 'linear-gradient(145deg, var(--color-accent-hover), var(--color-accent) 70%)',
        boxShadow: perf.glow ? '0 6px 18px var(--color-accent-glow)' : undefined,
      }}
    >
      {pulse && (
        <span
          aria-hidden
          className="chat-motion absolute inset-0 rounded-[32%] border border-[var(--color-accent)]"
          style={{ animation: 'chat-live 2.4s ease-out infinite' }}
        />
      )}
      <Globe size={Math.round(size * 0.46)} strokeWidth={2} />
    </span>
  );
});
