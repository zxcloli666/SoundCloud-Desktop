import { create } from 'zustand';
import { chatBridge } from '../../../../lib/chat/bridge';
import { chatError } from '../../../../lib/chat/errors';
import type { MediaId, MyMedia } from '../../../../lib/chat/media-types';
import type { ChatError } from '../../../../lib/chat/types';
import type { Load } from '../../storage/storage-store';
import { refOf, worthAsking } from './stored-list';

const PAGE = 100;

interface StoredData {
  items: MyMedia[];
  known: ReadonlySet<MediaId>;
  cursor: string | null;
  pages: number;
  load: Load;
  more: Load;
  error: ChatError | null;
}

interface StoredState extends StoredData {
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  leave: () => void;
}

const EMPTY: StoredData = {
  items: [],
  known: new Set(),
  cursor: null,
  pages: 0,
  load: 'idle',
  more: 'idle',
  error: null,
};

let ticket = 0;

async function fetchPage(cursor: string | null) {
  const page = await chatBridge.mediaMine({ order: 'new', cursor, limit: PAGE });
  const asked = page.items.filter(worthAsking);
  const known = asked.length > 0 ? await chatBridge.mediaKnown(asked.map(refOf)) : [];
  return { items: asked, known, cursor: page.next_cursor };
}

export const useStoredStore = create<StoredState>()((set, get) => ({
  ...EMPTY,

  reload: async () => {
    const mine = ++ticket;
    set({ ...EMPTY, load: 'loading' });
    try {
      const page = await fetchPage(null);
      if (mine !== ticket) return;
      set({
        items: page.items,
        known: new Set(page.known),
        cursor: page.cursor,
        pages: 1,
        load: 'ready',
      });
    } catch (error) {
      if (mine === ticket) set({ load: 'failed', error: chatError(error) ?? { code: 'internal' } });
    }
  },

  loadMore: async () => {
    const { cursor, more, load } = get();
    if (!cursor || more === 'loading' || load !== 'ready') return;
    const mine = ticket;
    set({ more: 'loading' });
    try {
      const page = await fetchPage(cursor);
      if (mine !== ticket) return;
      const { items, known, pages } = get();
      const seen = new Set(items.map((item) => item.id));
      set({
        items: [...items, ...page.items.filter((item) => !seen.has(item.id))],
        known: new Set([...known, ...page.known]),
        cursor: page.cursor,
        pages: pages + 1,
        more: 'ready',
      });
    } catch {
      if (mine === ticket) set({ more: 'failed' });
    }
  },

  leave: () => {
    ticket += 1;
    set(EMPTY);
  },
}));
