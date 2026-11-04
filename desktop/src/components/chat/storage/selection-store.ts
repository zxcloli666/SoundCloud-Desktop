import { create } from 'zustand';
import type { MediaId } from '../../../lib/chat/media-types';

export interface SelectionState {
  picked: ReadonlySet<MediaId>;
  anchor: MediaId | null;
  toggle: (id: MediaId) => void;
  range: (ids: MediaId[], index: number) => void;
  pickAll: (ids: MediaId[]) => void;
  keepOnly: (ids: MediaId[]) => void;
  clear: () => void;
}

const EMPTY: ReadonlySet<MediaId> = new Set();

export const useSelectionStore = create<SelectionState>()((set, get) => ({
  picked: EMPTY,
  anchor: null,
  toggle: (id) => {
    const picked = new Set(get().picked);
    if (picked.has(id)) picked.delete(id);
    else picked.add(id);
    set({ picked, anchor: id });
  },
  range: (ids, index) => {
    const { anchor } = get();
    const found = anchor === null ? -1 : ids.indexOf(anchor);
    const from = found < 0 ? index : Math.min(found, index);
    const to = found < 0 ? index : Math.max(found, index);
    const picked = new Set(get().picked);
    for (const id of ids.slice(from, to + 1)) picked.add(id);
    set({ picked, anchor: found < 0 ? (ids[index] ?? null) : anchor });
  },
  pickAll: (ids) => set({ picked: new Set(ids), anchor: null }),
  keepOnly: (ids) => {
    const known = new Set(ids);
    const { picked: current, anchor } = get();
    const picked = new Set([...current].filter((id) => known.has(id)));
    const keptAnchor = anchor !== null && known.has(anchor) ? anchor : null;
    if (picked.size !== current.size || keptAnchor !== anchor) set({ picked, anchor: keptAnchor });
  },
  clear: () => {
    if (get().picked.size > 0 || get().anchor !== null) set({ picked: EMPTY, anchor: null });
  },
}));
