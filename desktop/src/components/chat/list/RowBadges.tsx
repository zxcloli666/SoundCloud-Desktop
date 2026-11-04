import { memo } from 'react';
import { ink } from '../../../lib/chat/tone';
import type { ConversationSummary } from '../../../lib/chat/types';
import { Pin } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { isMuted, unreadLabel } from './mute';

interface RowBadgesProps {
  conversation: ConversationSummary;
  failed: boolean;
}

function Pill({ children, dim }: { children: string; dim: boolean }) {
  const glow = usePerfMode().glow;
  return (
    <span
      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums leading-none"
      style={
        dim
          ? { background: ink(14), color: ink(70) }
          : {
              background: 'var(--color-accent)',
              color: 'var(--color-accent-contrast)',
              boxShadow: glow ? '0 0 12px var(--color-accent-glow)' : undefined,
            }
      }
    >
      {children}
    </span>
  );
}

export const RowBadges = memo(function RowBadges({ conversation, failed }: RowBadgesProps) {
  if (failed) {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-rose-500/90 text-[12px] font-black leading-none text-white">
        !
      </span>
    );
  }
  const dim = isMuted(conversation, Date.now());
  if (conversation.mentions > 0) return <Pill dim={false}>@</Pill>;
  if (conversation.unread > 0) return <Pill dim={dim}>{unreadLabel(conversation.unread)}</Pill>;
  if (conversation.pinnedAt !== null) {
    return <Pin size={12} className="rotate-45 text-ink-30" />;
  }
  return null;
});
