import { create } from 'zustand';
import type { MediaId } from '../../../lib/chat/media-types';

export interface SelectionState {
  picked: ReadonlySet<MediaId>;
  anchor: number | null;
  toggle: (id: MediaId, index: number) => void;
  range: (ids: MediaId[], index: number) => void;
  pickAll: (ids: MediaId[]) => void;
  keepOnly: (ids: MediaId[]) => void;
  clear: () => void;
}

const EMPTY: ReadonlySet<MediaId> = new Set();

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  picked: EMPTY,
  anchor: null,
  toggle: (id, index) => {
    const picked = new Set(get().picked);
    if (picked.has(id)) picked.delete(id);
    else picked.add(id);
    set({ picked, anchor: index });
  },
  range: (ids, index) => {
    const anchor = get().anchor ?? index;
    const from = Math.min(anchor, index);
    const to = Math.max(anchor, index);
    const picked = new Set(get().picked);
    for (const id of ids.slice(from, to + 1)) picked.add(id);
    set({ picked, anchor });
  },
  pickAll: (ids) => set({ picked: new Set(ids), anchor: null }),
  keepOnly: (ids) => {
    const known = new Set(ids);
    const current = get().picked;
    const picked = new Set([...current].filter((id) => known.has(id)));
    if (picked.size !== current.size) set({ picked });
  },
  clear: () => {
    if (get().picked.size > 0 || get().anchor !== null) set({ picked: EMPTY, anchor: null });
  },
}));
