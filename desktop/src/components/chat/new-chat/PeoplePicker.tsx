import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { UserId, UserRef } from '../../../lib/chat/types';
import { useMyFollowings } from '../../../lib/hooks';
import { MIN_SEARCH_QUERY, useScStrip } from '../../../lib/search';
import { useChatStore } from '../../../stores/chat';
import { useDebouncedValue } from '../../discover/useDebouncedValue';
import { Skeleton } from '../../ui/Skeleton';
import { PersonRow } from './PersonRow';
import { userRef } from './people';

const FOLLOWINGS_LIMIT = 50;
const NOBODY: ReadonlySet<UserId> = new Set();

interface PeoplePickerProps {
  query: string;
  picked: UserRef[];
  full: boolean;
  exclude?: ReadonlySet<UserId>;
  onToggle: (person: UserRef) => void;
}

export const PeoplePicker = memo(function PeoplePicker({
  query,
  picked,
  full,
  exclude = NOBODY,
  onToggle,
}: PeoplePickerProps) {
  const { t } = useTranslation();
  const text = useDebouncedValue(query.trim(), 250);
  const searching = text.length >= MIN_SEARCH_QUERY;
  const followings = useMyFollowings(FOLLOWINGS_LIMIT, !searching);
  const results = useScStrip('users', searching ? text : '');
  const source = searching ? results.data : followings.items;
  const myId = useChatStore((state) => state.status?.userId ?? null);
  const people = useMemo(
    () =>
      (source ?? []).map(userRef).filter((person) => person.id !== myId && !exclude.has(person.id)),
    [source, myId, exclude],
  );
  const pickedIds = useMemo(() => new Set(picked.map((person) => person.id)), [picked]);
  const loading = searching ? results.isLoading : followings.isLoading;

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2.5 pb-1 text-[10.5px] font-bold tracking-[0.18em] text-ink-30 uppercase">
        {t(searching ? 'chat.list.new.people' : 'chat.list.new.following')}
      </p>
      {loading &&
        Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-2.5 py-2">
            <Skeleton rounded="full" className="size-[38px] shrink-0" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        ))}
      {!loading && people.length === 0 && (
        <p className="px-2.5 py-6 text-center text-[12.5px] text-ink-40">
          {t('chat.list.new.nobody')}
        </p>
      )}
      {people.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          picked={pickedIds.has(person.id)}
          disabled={full}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
});
