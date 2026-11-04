import { create } from 'zustand';
import type { ConvId, Message } from '../../../lib/chat/types';

export type ThreadDialog =
  | { kind: 'delete'; conversationId: ConvId; message: Message }
  | { kind: 'report'; conversationId: ConvId; message: Message }
  | { kind: 'forward'; conversationId: ConvId; message: Message }
  | { kind: 'link'; conversationId: ConvId; url: string };

export interface ReactionTarget {
  message: Message;
  x: number;
  y: number;
}

interface ThreadDialogsState {
  dialog: ThreadDialog | null;
  picker: ReactionTarget | null;
  open: (dialog: ThreadDialog) => void;
  close: () => void;
  openPicker: (picker: ReactionTarget) => void;
  closePicker: () => void;
}

export const useThreadDialogs = create<ThreadDialogsState>()((set) => ({
  dialog: null,
  picker: null,
  open: (dialog) => set({ dialog, picker: null }),
  close: () => set({ dialog: null }),
  openPicker: (picker) => set({ picker }),
  closePicker: () => set({ picker: null }),
}));
