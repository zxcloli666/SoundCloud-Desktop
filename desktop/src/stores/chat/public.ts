import { create } from 'zustand';
import { chatBridge } from '../../lib/chat/bridge';
import { chatError } from '../../lib/chat/errors';
import type { ConversationSummary, ConvId, Millis, UserId, UserRef } from '../../lib/chat/types';
import { useChatListStore } from './list';

export type PublicGate =
  | { kind: 'muted'; until: Millis }
  | { kind: 'off' }
  | { kind: 'failed' }
  | null;

export interface Sanction {
  mutedUntil: Millis | null;
  banned: boolean;
}

export interface PublicState {
  online: number;
  gate: PublicGate;
  opening: boolean;
  mutedUntil: Millis | null;
  slowUntil: Millis | null;
  sanctions: Record<UserId, Sanction>;
  people: Record<UserId, UserRef>;
  open: () => Promise<ConvId | null>;
  resolve: (ids: UserId[]) => Promise<void>;
  noteSent: (conversation: ConversationSummary) => void;
  noteError: (error: unknown) => void;
  noteSanction: (userId: UserId, patch: Partial<Sanction>) => void;
  clear: () => void;
}

const NO_SANCTION: Sanction = { mutedUntil: null, banned: false };
const pending = new Set<UserId>();

function isStaff(conversation: ConversationSummary): boolean {
  return conversation.role === 'owner' || conversation.role === 'admin';
}

function gateOf(error: unknown): PublicGate {
  const known = chatError(error);
  if (known?.code === 'muted' && known.until) return { kind: 'muted', until: known.until };
  if (known?.code === 'disabled') return { kind: 'off' };
  return { kind: 'failed' };
}

export function sanctionOf(state: PublicState, userId: UserId): Sanction {
  return state.sanctions[userId] ?? NO_SANCTION;
}

export const usePublicStore = create<PublicState>()((set, get) => ({
  online: 0,
  gate: null,
  opening: false,
  mutedUntil: null,
  slowUntil: null,
  sanctions: {},
  people: {},

  open: async () => {
    set({ opening: true });
    try {
      const opened = await chatBridge.publicOpen();
      useChatListStore.getState().upsert(opened.conversation);
      set({ online: opened.online, gate: null, opening: false });
      return opened.conversation.id;
    } catch (error) {
      set({ gate: gateOf(error), opening: false });
      return null;
    }
  },

  resolve: async (ids) => {
    const known = get().people;
    const wanted = ids.filter((id) => !known[id] && !pending.has(id));
    if (wanted.length === 0) return;
    for (const id of wanted) pending.add(id);
    try {
      const found = await chatBridge.publicPeople(wanted);
      set((state) => {
        const people = { ...state.people };
        for (const user of found) people[user.id] = user;
        return { people };
      });
    } catch {
      return;
    } finally {
      for (const id of wanted) pending.delete(id);
    }
  },

  noteSent: (conversation) => {
    if (conversation.slowModeS <= 0 || isStaff(conversation)) return;
    set({ slowUntil: Date.now() + conversation.slowModeS * 1000 });
  },

  noteError: (error) => {
    const known = chatError(error);
    if (known?.code === 'muted' && known.until) set({ mutedUntil: known.until });
    if (known?.code === 'slow_mode' && known.retryMs) {
      set({ slowUntil: Date.now() + known.retryMs });
    }
  },

  noteSanction: (userId, patch) =>
    set((state) => ({
      sanctions: { ...state.sanctions, [userId]: { ...sanctionOf(state, userId), ...patch } },
    })),

  clear: () =>
    set({
      online: 0,
      gate: null,
      opening: false,
      mutedUntil: null,
      slowUntil: null,
      sanctions: {},
      people: {},
    }),
}));
