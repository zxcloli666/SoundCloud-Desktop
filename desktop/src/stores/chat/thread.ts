import { create } from 'zustand';
import { chatBridge } from '../../lib/chat/bridge';
import type {
  ClientId,
  ConversationMarks,
  ConversationSummary,
  ConvId,
  DeleteScope,
  Embed,
  GoneEvent,
  Member,
  Message,
  MessagesEvent,
  PeerMark,
  RichText,
  Seq,
  TypingEvent,
  UserId,
} from '../../lib/chat/types';
import { useChatListStore } from './list';
import {
  expiredSeqs,
  goneByConversation,
  mergeMessages,
  oldestSeq,
  outgoing,
  toggleReaction,
  withMarks,
  withoutSeqs,
  withPins,
  withSystemChanges,
} from './thread-messages';

const PAGE_SIZE = 60;
const KEEP_THREADS = 8;
const JUMP_PAGES = 20;

export type ThreadLoad = 'idle' | 'loading' | 'ready' | 'failed' | 'gone';

export interface Compose {
  reply: Seq | null;
  edit: ClientId | null;
}

export interface UnreadMark {
  after: Seq;
  count: number;
}

export interface ThreadState {
  conversation: ConversationSummary | null;
  messages: Message[];
  moreBefore: boolean;
  loadingBefore: boolean;
  marks: PeerMark[];
  pins: Seq[];
  typing: UserId[];
  draft: RichText | null;
  unread: UnreadMark | null;
  readSeq: Seq;
  members: Member[];
  load: ThreadLoad;
  compose: Compose;
  openedAt: number;
}

export interface ChatThreadState {
  openId: ConvId | null;
  threads: Record<ConvId, ThreadState>;
  setOpen: (conversationId: ConvId | null) => void;
  load: (conversationId: ConvId) => Promise<void>;
  loadBefore: (conversationId: ConvId) => Promise<void>;
  loadUntil: (conversationId: ConvId, seq: Seq) => Promise<boolean>;
  loadMembers: (conversationId: ConvId) => Promise<void>;
  setCompose: (conversationId: ConvId, compose: Partial<Compose>) => void;
  setConversation: (summary: ConversationSummary) => void;
  send: (conversationId: ConvId, text: RichText, embeds: Embed[], album?: string) => Promise<void>;
  retry: (message: Message) => Promise<void>;
  discard: (message: Message) => Promise<void>;
  edit: (conversationId: ConvId, seq: Seq, text: RichText) => Promise<void>;
  remove: (message: Message, scope: DeleteScope) => Promise<void>;
  react: (message: Message, emoji: string) => Promise<void>;
  pin: (message: Message, on: boolean) => Promise<void>;
  markRead: (conversationId: ConvId, seq: Seq) => void;
  setTtl: (conversationId: ConvId, ttlS: number | null) => Promise<void>;
  applyMessages: (event: MessagesEvent) => void;
  applyTyping: (event: TypingEvent) => void;
  applyMarks: (marks: ConversationMarks[]) => void;
  applyGone: (event: GoneEvent) => void;
  purgeExpired: (now: number) => void;
  clear: () => void;
}

const NO_COMPOSE: Compose = { reply: null, edit: null };

function emptyThread(): ThreadState {
  return {
    conversation: null,
    messages: [],
    moreBefore: false,
    loadingBefore: false,
    marks: [],
    pins: [],
    typing: [],
    draft: null,
    unread: null,
    readSeq: 0,
    members: [],
    load: 'idle',
    compose: NO_COMPOSE,
    openedAt: 0,
  };
}

function unreadMark(conversation: ConversationSummary): UnreadMark | null {
  return conversation.unread > 0
    ? { after: conversation.lastReadSeq, count: conversation.unread }
    : null;
}

function evicted(threads: Record<ConvId, ThreadState>, keep: ConvId): Record<ConvId, ThreadState> {
  const loaded = Object.entries(threads)
    .filter(([id, thread]) => id !== keep && thread.load === 'ready')
    .sort(([, a], [, b]) => b.openedAt - a.openedAt);
  if (loaded.length < KEEP_THREADS) return threads;
  const next = { ...threads };
  for (const [id, thread] of loaded.slice(KEEP_THREADS - 1)) {
    next[id] = { ...emptyThread(), messages: outgoing(thread.messages), typing: thread.typing };
  }
  return next;
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null;

export const useChatThreadStore = create<ChatThreadState>()((set, get) => {
  const thread = (id: ConvId) => get().threads[id] ?? emptyThread();

  const patch = (id: ConvId, change: (thread: ThreadState) => Partial<ThreadState>) => {
    let touched = false;
    set((state) => {
      const current = state.threads[id] ?? emptyThread();
      const next = change(current);
      touched = next.messages !== undefined;
      return { threads: { ...state.threads, [id]: { ...current, ...next } } };
    });
    if (touched) scheduleExpiry();
  };

  const putMessages = (id: ConvId, incoming: Message[]) =>
    patch(id, (current) => ({
      messages: mergeMessages(current.messages, incoming),
      pins: withPins(current.pins, incoming),
    }));

  const dropMessage = (id: ConvId, clientId: ClientId) =>
    patch(id, (current) => ({
      messages: current.messages.filter((message) => message.clientId !== clientId),
    }));

  const scheduleExpiry = () => {
    let next = Number.POSITIVE_INFINITY;
    for (const current of Object.values(get().threads)) {
      for (const message of current.messages) {
        if (message.expiresAt !== null && message.expiresAt < next) next = message.expiresAt;
      }
    }
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    if (next === Number.POSITIVE_INFINITY) return;
    const wait = Math.min(Math.max(0, next - Date.now()) + 50, 3_600_000);
    expiryTimer = setTimeout(() => get().purgeExpired(Date.now()), wait);
  };

  const fetchPage = async (id: ConvId, before: Seq) => {
    patch(id, () => ({ loadingBefore: true }));
    try {
      const page = await chatBridge.history(id, { before, limit: PAGE_SIZE });
      patch(id, (current) => ({
        messages: mergeMessages(current.messages, page.messages),
        pins: withPins(current.pins, page.messages),
        moreBefore: page.more,
        loadingBefore: false,
      }));
    } catch (error) {
      patch(id, () => ({ loadingBefore: false }));
      throw error;
    }
  };

  return {
    openId: null,
    threads: {},
    setOpen: (openId) => set({ openId }),

    load: async (id) => {
      set((state) => ({ threads: evicted(state.threads, id) }));
      patch(id, () => ({ load: thread(id).load === 'ready' ? 'ready' : 'loading' }));
      try {
        const snapshot = await chatBridge.open(id);
        const oldest = oldestSeq(snapshot.messages) ?? 0;
        patch(id, (current) => ({
          conversation: snapshot.conversation,
          messages: mergeMessages(
            snapshot.messages,
            current.messages.filter((message) => message.seq === null || message.seq >= oldest),
          ),
          moreBefore: snapshot.moreBefore,
          marks: snapshot.marks,
          pins: snapshot.pins,
          typing: snapshot.typing,
          draft: snapshot.draft,
          unread: unreadMark(snapshot.conversation),
          readSeq: snapshot.conversation.lastReadSeq,
          load: 'ready',
          openedAt: Date.now(),
        }));
        useChatListStore.getState().upsert(snapshot.conversation);
        if (snapshot.conversation.kind === 'group' || snapshot.conversation.kind === 'room') {
          void get().loadMembers(id);
        }
      } catch {
        patch(id, (current) => ({ load: current.load === 'ready' ? 'ready' : 'failed' }));
      }
    },

    loadBefore: async (id) => {
      const current = thread(id);
      const before = oldestSeq(current.messages);
      if (!current.moreBefore || current.loadingBefore || before === null) return;
      await fetchPage(id, before).catch(() => undefined);
    },

    loadUntil: async (id, seq) => {
      for (let page = 0; page < JUMP_PAGES; page++) {
        const current = thread(id);
        const before = oldestSeq(current.messages);
        if (before !== null && before <= seq) return true;
        if (!current.moreBefore || before === null) return false;
        await fetchPage(id, before);
      }
      return false;
    },

    loadMembers: async (id) => {
      const members = await chatBridge.members(id).catch(() => null);
      if (members) patch(id, () => ({ members }));
    },

    setCompose: (id, compose) =>
      patch(id, (current) => ({ compose: { ...current.compose, ...compose } })),

    setConversation: (summary) => {
      patch(summary.id, () => ({ conversation: summary }));
      useChatListStore.getState().upsert(summary);
    },

    send: async (id, text, embeds, album) => {
      const reply = thread(id).compose.reply;
      patch(id, () => ({ compose: NO_COMPOSE, draft: null }));
      try {
        const input = { conversationId: id, text, embeds, replyTo: reply };
        const message = album
          ? await chatBridge.mediaSend(input, album)
          : await chatBridge.send(input);
        putMessages(id, [message]);
      } catch (error) {
        patch(id, (current) => ({ compose: { ...current.compose, reply } }));
        throw error;
      }
    },

    retry: async (message) => {
      if (message.body.type !== 'text') return;
      const id = message.conversationId;
      putMessages(id, [{ ...message, state: 'pending' }]);
      try {
        const sent = await chatBridge.send({
          conversationId: id,
          clientId: message.clientId,
          text: { text: message.body.text, spans: message.body.spans },
          replyTo: message.replyTo,
          embeds: message.embeds,
        });
        putMessages(id, [sent]);
      } catch (error) {
        putMessages(id, [{ ...message, state: 'failed' }]);
        throw error;
      }
    },

    discard: async (message) => {
      await chatBridge.remove(message.conversationId, { pending: message.clientId }, 'me');
      dropMessage(message.conversationId, message.clientId);
    },

    edit: async (id, seq, text) => {
      patch(id, () => ({ compose: NO_COMPOSE }));
      const edited = await chatBridge.edit(id, seq, text);
      putMessages(id, [edited]);
    },

    remove: async (message, scope) => {
      if (message.seq === null) return get().discard(message);
      const id = message.conversationId;
      await chatBridge.remove(id, { seq: message.seq }, scope);
      if (scope === 'me') dropMessage(id, message.clientId);
      else putMessages(id, [{ ...message, body: { type: 'deleted' }, embeds: [], reactions: [] }]);
    },

    react: async (message, emoji) => {
      if (message.seq === null) return;
      const on = !message.reactions.some((group) => group.emoji === emoji && group.mine);
      const optimistic = { ...message, reactions: toggleReaction(message.reactions, emoji) };
      putMessages(message.conversationId, [optimistic]);
      try {
        await chatBridge.react(message.conversationId, message.seq, emoji, on);
      } catch (error) {
        putMessages(message.conversationId, [message]);
        throw error;
      }
    },

    pin: async (message, on) => {
      if (message.seq === null) return;
      putMessages(message.conversationId, [{ ...message, pinned: on }]);
      try {
        await chatBridge.pin(message.conversationId, message.seq, on);
      } catch (error) {
        putMessages(message.conversationId, [message]);
        throw error;
      }
    },

    markRead: (id, seq) => {
      if (seq <= thread(id).readSeq) return;
      patch(id, () => ({ readSeq: seq }));
      void chatBridge.markRead(id, seq).catch(() => undefined);
    },

    setTtl: async (id, ttlS) => {
      get().setConversation(await chatBridge.setTtl(id, ttlS));
    },

    applyMessages: (event) => {
      const known = get().threads[event.conversationId];
      if (!known || (known.load !== 'ready' && known.load !== 'loading')) {
        const pending = outgoing(mergeMessages(known?.messages ?? [], event.messages));
        if (known || pending.length > 0) patch(event.conversationId, () => ({ messages: pending }));
        return;
      }
      const live = event.origin !== 'history';
      patch(event.conversationId, (current) => ({
        messages: mergeMessages(current.messages, event.messages),
        pins: withPins(current.pins, event.messages),
        conversation: live
          ? withSystemChanges(current.conversation, event.messages)
          : current.conversation,
      }));
    },

    applyTyping: (event) => patch(event.conversationId, () => ({ typing: event.users })),

    applyMarks: (marks) => {
      for (const entry of marks) {
        if (!get().threads[entry.conversationId]) continue;
        patch(entry.conversationId, (current) => ({
          marks: withMarks(current.marks, entry.marks),
        }));
      }
    },

    applyGone: (event) => {
      set((state) => {
        const threads = { ...state.threads };
        for (const id of event.conversations) {
          if (threads[id]) threads[id] = { ...emptyThread(), load: 'gone' };
        }
        for (const [id, seqs] of goneByConversation(event.messages)) {
          if (threads[id]) threads[id] = withoutSeqs(threads[id], seqs);
        }
        return { threads };
      });
      scheduleExpiry();
    },

    clear: () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = null;
      set({ openId: null, threads: {} });
    },

    purgeExpired: (now) => {
      set((state) => {
        let changed = false;
        const threads = { ...state.threads };
        for (const [id, current] of Object.entries(threads)) {
          const seqs = expiredSeqs(current.messages, now);
          if (seqs.size === 0) continue;
          threads[id] = withoutSeqs(current, seqs);
          changed = true;
        }
        return changed ? { threads } : state;
      });
      scheduleExpiry();
    },
  };
});
