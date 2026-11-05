import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserRef } from '../../../lib/chat/types';
import { X } from '../../../lib/icons';
import { Avatar } from '../../ui/Avatar';

interface PickedChipsProps {
  people: UserRef[];
  onRemove: (person: UserRef) => void;
}

export const PickedChips = memo(function PickedChips({ people, onRemove }: PickedChipsProps) {
  const { t } = useTranslation();
  if (people.length === 0) return null;
  return (
    <div className="flex max-h-[76px] flex-wrap gap-1.5 overflow-y-auto">
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onRemove(person)}
          title={t('chat.list.new.remove')}
          className="group flex h-7 cursor-pointer items-center gap-1.5 rounded-full border border-ink/[0.08] bg-ink/[0.06] pr-2 pl-0.5 text-[12px] font-medium text-ink-80 transition-colors hover:bg-ink/[0.1]"
        >
          <Avatar src={person.avatarUrl} alt={person.name} size={24} />
          <span className="max-w-[120px] truncate">{person.name}</span>
          <X size={11} className="text-ink-40 group-hover:text-ink-80" />
        </button>
      ))}
    </div>
  );
});
