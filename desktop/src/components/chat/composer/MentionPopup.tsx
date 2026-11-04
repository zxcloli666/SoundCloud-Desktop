import { memo } from 'react';
import { senderColor } from '../../../lib/chat/render';
import { surface } from '../../../lib/chat/tone';
import type { UserRef } from '../../../lib/chat/types';
import { Avatar } from '../../ui/Avatar';

export const MentionPopup = memo(function MentionPopup({
  people,
  active,
  onPick,
}: {
  people: UserRef[];
  active: number;
  onPick: (user: UserRef) => void;
}) {
  return (
    <div
      role="listbox"
      className="chat-thread-motion absolute inset-x-3 bottom-full z-20 mb-2 overflow-hidden rounded-2xl border border-ink/[0.08] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
      style={{ background: surface(10), animation: 'chat-thread-rise 140ms ease-out' }}
    >
      {people.map((user, index) => (
        <button
          key={user.id}
          type="button"
          role="option"
          aria-selected={index === active}
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(user);
          }}
          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-100 ${
            index === active ? 'bg-ink/[0.08]' : 'hover:bg-ink/[0.05]'
          }`}
        >
          <Avatar src={user.avatarUrl} size={24} />
          <span
            className="truncate text-[13px] font-semibold"
            style={{ color: senderColor(user.id) }}
          >
            {user.name}
          </span>
        </button>
      ))}
    </div>
  );
});
