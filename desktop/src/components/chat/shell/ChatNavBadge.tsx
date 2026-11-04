import { memo } from 'react';
import { usePerfMode } from '../../../lib/perf';
import { useChatStore } from '../../../stores/chat';
import { unreadLabel } from '../list/mute';

export const ChatNavBadge = memo(function ChatNavBadge({ collapsed }: { collapsed: boolean }) {
  const glow = usePerfMode().glow;
  const unread = useChatStore((state) => state.status?.unread ?? 0);
  const mentions = useChatStore((state) => state.status?.mentions ?? 0);
  const requests = useChatStore((state) => state.status?.requests ?? 0);
  const count = unread + requests;
  if (count === 0 && mentions === 0) return null;
  const label = mentions > 0 ? '@' : unreadLabel(count);
  const style = {
    background: 'var(--color-accent)',
    color: 'var(--color-accent-contrast)',
    boxShadow: glow ? '0 0 12px var(--color-accent-glow)' : undefined,
  };

  if (collapsed) {
    return (
      <span
        className="absolute top-1 left-[26px] flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold leading-none tabular-nums"
        style={style}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="mr-2.5 ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold leading-none tabular-nums"
      style={style}
    >
      {label}
    </span>
  );
});
