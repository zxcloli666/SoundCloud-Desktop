import type { TFunction } from 'i18next';
import { createContext, useContext } from 'react';
import type { NameOf } from '../../../lib/chat/render';
import type { ConversationSummary, Seq, UserId, UserRef } from '../../../lib/chat/types';

export interface ThreadContextValue {
  t: TFunction;
  language: string;
  conversation: ConversationSummary;
  me: UserId | null;
  people: Map<UserId, UserRef>;
  blocked: ReadonlySet<UserId>;
  moderator: boolean;
  nameOf: NameOf;
  jumpTo: (seq: Seq) => void;
}

export const ThreadContext = createContext<ThreadContextValue | null>(null);

export function useThread(): ThreadContextValue {
  const value = useContext(ThreadContext);
  if (!value) throw new Error('useThread outside ThreadContext');
  return value;
}
