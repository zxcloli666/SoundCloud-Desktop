import { create } from 'zustand';
import type { ConversationSummary } from '../../../lib/chat/types';

interface DeleteChatState {
  open: boolean;
  target: ConversationSummary | null;
  close: () => void;
}

export const useDeleteChatStore = create<DeleteChatState>()((set) => ({
  open: false,
  target: null,
  close: () => set({ open: false }),
}));

export function openDeleteChat(target: ConversationSummary) {
  useDeleteChatStore.setState({ open: true, target });
}
