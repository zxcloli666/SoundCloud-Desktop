import { memo } from 'react';
import { ink } from '../../../lib/chat/tone';
import type { ConversationKind } from '../../../lib/chat/types';
import { art } from '../../../lib/formatters';
import { Bookmark, Check, Headphones, User, Users } from '../../../lib/icons';

interface ShareTileProps {
  id: string;
  kind: ConversationKind;
  title: string;
  avatarUrl: string | null;
  selected: boolean;
  onToggle: (id: string) => void;
}

function Glyph({ kind }: { kind: ConversationKind }) {
  if (kind === 'self') return <Bookmark size={20} />;
  if (kind === 'room') return <Headphones size={20} />;
  if (kind === 'direct') return <User size={20} />;
  return <Users size={20} />;
}

export const ShareTile = memo(function ShareTile({
  id,
  kind,
  title,
  avatarUrl,
  selected,
  onToggle,
}: ShareTileProps) {
  const src = kind === 'self' || kind === 'room' ? null : art(avatarUrl, 't200x200');
  const shape = kind === 'direct' ? 'rounded-full' : 'rounded-[16px]';
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={title}
      onClick={() => onToggle(id)}
      className="group/tile flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-colors duration-200 cursor-pointer hover:bg-ink/[0.04]"
    >
      <span className="relative">
        <span
          className={`flex h-[52px] w-[52px] items-center justify-center overflow-hidden ${shape} transition-transform duration-300 ease-[var(--ease-apple)] ${
            selected ? 'scale-[0.9]' : 'group-hover/tile:scale-[1.04]'
          } ${kind === 'room' ? 'bg-accent/15 text-accent' : 'bg-ink/[0.06] text-ink-45'}`}
          style={{
            boxShadow: selected
              ? '0 0 0 2px var(--color-accent), 0 0 18px var(--color-accent-glow)'
              : `inset 0 0 0 0.5px ${ink(10)}`,
          }}
        >
          {src ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="h-full w-full object-cover"
            />
          ) : (
            <Glyph kind={kind} />
          )}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-contrast transition-all duration-300 ease-[var(--ease-apple)] ${
            selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
          }`}
          style={{ boxShadow: '0 0 0 2px var(--color-chat-cutout)' }}
        >
          <Check size={12} strokeWidth={3} />
        </span>
      </span>
      <span
        className={`line-clamp-2 w-full text-center text-[11.5px] leading-tight ${
          selected ? 'text-ink' : 'text-ink-65'
        }`}
      >
        {title}
      </span>
    </button>
  );
});
