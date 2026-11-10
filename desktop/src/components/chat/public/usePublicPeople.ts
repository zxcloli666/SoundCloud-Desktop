import { useEffect } from 'react';
import type { ConvId, UserId, UserRef } from '../../../lib/chat/types';
import { usePublicStore } from '../../../stores/chat/public';
import { useChatThreadStore } from '../../../stores/chat/thread';

const NONE: Record<UserId, UserRef> = {};

export function usePublicPeople(conversationId: ConvId, on: boolean): Record<UserId, UserRef> {
  const people = usePublicStore((state) => (on ? state.people : NONE));
  const senders = useChatThreadStore((state) => {
    if (!on) return '';
    const ids = new Set<UserId>();
    for (const message of state.threads[conversationId]?.messages ?? []) ids.add(message.sender);
    return [...ids].sort().join(' ');
  });

  useEffect(() => {
    if (!senders) return;
    const known = usePublicStore.getState().people;
    const missing = senders.split(' ').filter((id) => !known[id]);
    if (missing.length > 0) void usePublicStore.getState().resolve(missing);
  }, [senders]);

  return people;
}
