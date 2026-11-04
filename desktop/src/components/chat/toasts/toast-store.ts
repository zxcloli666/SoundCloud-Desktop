import { create } from 'zustand';
import type { ConvId, Message } from '../../../lib/chat/types';

const VISIBLE_MAX = 3;

export interface ChatToastItem {
  conversationId: ConvId;
  message: Message;
  count: number;
  updatedAt: number;
}

interface ChatToastState {
  items: ChatToastItem[];
  push: (message: Message, now: number) => void;
  dismiss: (conversationId: ConvId) => void;
  clear: () => void;
}

export const useChatToastStore = create<ChatToastState>()((set) => ({
  items: [],
  push: (message, now) =>
    set((state) => {
      const current = state.items.find((item) => item.conversationId === message.conversationId);
      if (current) {
        return {
          items: state.items.map((item) =>
            item === current ? { ...item, message, count: item.count + 1, updatedAt: now } : item,
          ),
        };
      }
      const next = { conversationId: message.conversationId, message, count: 1, updatedAt: now };
      return { items: [next, ...state.items].slice(0, VISIBLE_MAX) };
    }),
  dismiss: (conversationId) =>
    set((state) => ({
      items: state.items.filter((item) => item.conversationId !== conversationId),
    })),
  clear: () => set({ items: [] }),
}));
