import { memo } from 'react';
import type { UserRef } from '../../../lib/chat/types';
import { Check } from '../../../lib/icons';
import { Avatar } from '../../ui/Avatar';

interface PersonRowProps {
  person: UserRef;
  picked: boolean;
  disabled: boolean;
  onToggle: (person: UserRef) => void;
}

export const PersonRow = memo(function PersonRow({
  person,
  picked,
  disabled,
  onToggle,
}: PersonRowProps) {
  return (
    <button
      type="button"
      aria-pressed={picked}
      disabled={disabled && !picked}
      onClick={() => onToggle(person)}
      className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200 disabled:cursor-default disabled:opacity-40 ${
        picked ? 'bg-ink/[0.07]' : 'hover:bg-ink/[0.05]'
      }`}
    >
      <Avatar src={person.avatarUrl} alt={person.name} size={38} />
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-85">
        {person.name}
      </span>
      <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
          picked
            ? 'border-transparent bg-[var(--color-accent)] text-[var(--color-accent-contrast)]'
            : 'border-ink/20'
        }`}
      >
        {picked && <Check size={12} strokeWidth={3} />}
      </span>
    </button>
  );
});
