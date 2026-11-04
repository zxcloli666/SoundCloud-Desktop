import { memo } from 'react';
import type { ReactionGroup } from '../../../lib/chat/types';

export const Reactions = memo(function Reactions({
  reactions,
  mine,
  onToggle,
}: {
  reactions: ReactionGroup[];
  mine: boolean;
  onToggle: (emoji: string) => void;
}) {
  return (
    <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : ''}`}>
      {reactions.map((group) => (
        <button
          key={group.emoji}
          type="button"
          aria-pressed={group.mine}
          onClick={() => onToggle(group.emoji)}
          className={`flex h-[24px] cursor-pointer items-center gap-1 rounded-full border px-2 transition-colors duration-150 ${
            group.mine
              ? 'border-[var(--color-accent)] text-ink'
              : 'border-ink/[0.07] bg-ink/[0.05] text-ink-70 hover:bg-ink/[0.09]'
          }`}
          style={group.mine ? { background: 'var(--color-chat-tint)' } : undefined}
        >
          <span className="text-[13px] leading-none">{group.emoji}</span>
          <span className="text-[11px] font-semibold tabular-nums">{group.count}</span>
        </button>
      ))}
    </div>
  );
});
