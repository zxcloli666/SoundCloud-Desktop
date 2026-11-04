import { create } from 'zustand';
import { chatBridge } from '../../lib/chat/bridge';
import type {
  ChatRequest,
  ConversationSummary,
  ConvId,
  GoneEvent,
  ListFilter,
  SyncEvent,
} from '../../lib/chat/types';

const PAGE_SIZE = 200;

export type ListLoad = 'idle' | 'loading' | 'ready' | 'failed';

export function isRequest(conversation: ConversationSummary): boolean {
  return conversation.state === 'invited' || !conversation.accepted;
}

function isListed(conversation: ConversationSummary): boolean {
  if (conversation.kind === 'room') return false;
  return conversation.state === 'active' || conversation.state === 'invited';
}

const MATCHES: Record<ListFilter, (conversation: ConversationSummary) => boolean> = {
  all: (c) => !c.archived && !isRequest(c),
  direct: (c) => !c.archived && !isRequest(c) && (c.kind === 'direct' || c.kind === 'self'),
  groups: (c) => !c.archived && !isRequest(c) && c.kind === 'group',
  unread: (c) => !c.archived && !isRequest(c) && c.unread > 0,
  requests: isRequest,
  archived: (c) => c.archived && !isRequest(c),
};

function newestFirst(a: ConversationSummary, b: ConversationSummary): number {
  if (a.pinnedAt !== null || b.pinnedAt !== null) {
    if (a.pinnedAt === null) return 1;
    if (b.pinnedAt === null) return -1;
    if (a.pinnedAt !== b.pinnedAt) return b.pinnedAt - a.pinnedAt;
  }
  return b.lastAt - a.lastAt;
}

export function listFor(
  byId: Record<ConvId, ConversationSummary>,
  filter: ListFilter,
): ConversationSummary[] {
  return Object.values(byId)
    .filter((c) => isListed(c) && MATCHES[filter](c))
    .sort(newestFirst);
}

function withSummaries(
  byId: Record<ConvId, ConversationSummary>,
  summaries: ConversationSummary[],
): Record<ConvId, ConversationSummary> {
  if (summaries.length === 0) return byId;
  const next = { ...byId };
  for (const summary of summaries) next[summary.id] = summary;
  return next;
}

export interface ChatListState {
  filter: ListFilter;
  items: ConversationSummary[];
  byId: Record<ConvId, ConversationSummary>;
  nextCursor: string | null;
  requests: number;
  requestItems: ChatRequest[];
  load: ListLoad;
  setFilter: (filter: ListFilter) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  upsert: (summary: ConversationSummary) => void;
  remove: (conversationId: ConvId) => void;
  settleRequest: (summary: ConversationSummary) => void;
  setRequests: (requests: number) => void;
  applySync: (event: SyncEvent) => void;
  applyGone: (event: GoneEvent) => void;
  clear: () => void;
}

let generation = 0;

export const useChatListStore = create<ChatListState>()((set, get) => {
  const place = (byId: Record<ConvId, ConversationSummary>) =>
    set({ byId, items: listFor(byId, get().filter) });

  const loadRequests = async (ticket: number) => {
    const requestItems = await chatBridge.requests();
    if (ticket !== generation) return;
    const byId = withSummaries(
      get().byId,
      requestItems.map((request) => request.conversation),
    );
    set({ requestItems, requests: requestItems.length, nextCursor: null, load: 'ready' });
    place(byId);
  };

  const loadPage = async (ticket: number, cursor: string | null) => {
    const filter = get().filter;
    const page = await chatBridge.list({ filter, cursor, limit: PAGE_SIZE });
    if (ticket !== generation) return;
    set({ nextCursor: page.nextCursor, load: 'ready' });
    place(withSummaries(get().byId, page.items));
  };

  const run = async (cursor: string | null) => {
    const ticket = cursor === null ? ++generation : generation;
    set({ load: 'loading' });
    try {
      if (get().filter === 'requests') await loadRequests(ticket);
      else await loadPage(ticket, cursor);
    } catch {
      if (ticket === generation) set({ load: 'failed' });
    }
  };

  return {
    filter: 'all',
    items: [],
    byId: {},
    nextCursor: null,
    requests: 0,
    requestItems: [],
    load: 'idle',
    setFilter: (filter) => {
      if (filter === get().filter) return;
      set({ filter, nextCursor: null, items: listFor(get().byId, filter) });
      void run(null);
    },
    refresh: () => run(null),
    loadMore: async () => {
      const { nextCursor, load } = get();
      if (nextCursor && load !== 'loading') await run(nextCursor);
    },
    upsert: (summary) => place(withSummaries(get().byId, [summary])),
    remove: (id) => {
      const byId = { ...get().byId };
      delete byId[id];
      set({ requestItems: get().requestItems.filter((r) => r.conversation.id !== id) });
      place(byId);
    },
    settleRequest: (summary) => {
      const requestItems = get().requestItems.filter((r) => r.conversation.id !== summary.id);
      set({ requestItems, requests: Math.max(0, get().requests - 1) });
      place(withSummaries(get().byId, [summary]));
    },
    setRequests: (requests) => set({ requests }),
    applySync: (event) => {
      const requestsChanged = event.requests !== get().requests;
      set({ requests: event.requests });
      if (event.reset) {
        place(withSummaries({}, event.conversations));
        void run(null);
        return;
      }
      place(withSummaries(get().byId, event.conversations));
      if (requestsChanged && get().filter === 'requests') void run(null);
    },
    applyGone: (event) => {
      if (event.conversations.length === 0) return;
      const gone = new Set(event.conversations);
      const byId = Object.fromEntries(Object.entries(get().byId).filter(([id]) => !gone.has(id)));
      set({ requestItems: get().requestItems.filter((r) => !gone.has(r.conversation.id)) });
      place(byId);
    },
    clear: () => {
      generation += 1;
      set({
        filter: 'all',
        items: [],
        byId: {},
        nextCursor: null,
        requests: 0,
        requestItems: [],
        load: 'idle',
      });
    },
  };
});
