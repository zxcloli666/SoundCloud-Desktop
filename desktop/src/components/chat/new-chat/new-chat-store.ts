import { create } from 'zustand';

interface NewChatState {
  open: boolean;
  session: number;
  close: () => void;
}

export const useNewChatStore = create<NewChatState>()((set) => ({
  open: false,
  session: 0,
  close: () => set({ open: false }),
}));

export function openNewChat() {
  useNewChatStore.setState((state) => ({ open: true, session: state.session + 1 }));
}
