import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { NameOf } from '../../../lib/chat/render';
import type { ConversationSummary, Member, UserId, UserRef } from '../../../lib/chat/types';
import { useAuthStore } from '../../../stores/auth';

const NO_MEMBERS: Member[] = [];

export function usePeople(
  conversation: ConversationSummary | null,
  members: Member[] | undefined,
  me: UserId | null,
): { people: Map<UserId, UserRef>; nameOf: NameOf } {
  const { t } = useTranslation();
  const user = useAuthStore((state) => state.user);
  const list = members ?? NO_MEMBERS;

  return useMemo(() => {
    const people = new Map<UserId, UserRef>();
    for (const member of list) people.set(member.user.id, member.user);
    const peer = conversation?.peer;
    if (peer) people.set(peer.id, peer);
    if (me && user) {
      people.set(me, {
        id: me,
        name: user.username,
        avatarUrl: user.avatar_url,
        permalink: user.permalink_url,
      });
    }
    const nameOf: NameOf = (userId) =>
      (userId && people.get(userId)?.name) || t('chat.thread.someone');
    return { people, nameOf };
  }, [list, conversation?.peer, me, user, t]);
}
