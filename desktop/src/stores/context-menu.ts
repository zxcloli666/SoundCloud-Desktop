import type { ReactNode } from 'react';
import { create } from 'zustand';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: string;
  checked?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export type ContextMenuEntry = ContextMenuItem | 'separator';

export interface ContextMenuRequest {
  x: number;
  y: number;
  header?: ReactNode;
  entries: ContextMenuEntry[];
}

interface ContextMenuState {
  menu: ContextMenuRequest | null;
  show: (menu: ContextMenuRequest) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>()((set) => ({
  menu: null,
  show: (menu) => set({ menu }),
  close: () => set({ menu: null }),
}));

export function openContextMenu(
  event: Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>,
  entries: ContextMenuEntry[],
  header?: ReactNode,
) {
  event.preventDefault();
  useContextMenuStore.getState().show({ x: event.clientX, y: event.clientY, header, entries });
}
