import { create } from 'zustand';
import { chatBridge } from '../../../lib/chat/bridge';
import { chatError } from '../../../lib/chat/errors';
import type {
  ConversationUsage,
  MediaId,
  MediaUsage,
  MineOrder,
  MyMedia,
} from '../../../lib/chat/media-types';
import type { ChatError, ConvId } from '../../../lib/chat/types';
import { syncUsed } from './sync-used';

const PAGE = 100;

export type Load = 'idle' | 'loading' | 'ready' | 'failed';

export interface Meter {
  used: number;
  quota: number;
}

export interface StorageState {
  usage: MediaUsage | null;
  usageLoad: Load;
  usageError: ChatError | null;
  meter: Meter | null;
  order: MineOrder;
  origin: ConvId | null;
  items: MyMedia[];
  cursor: string | null;
  itemsLoad: Load;
  itemsError: ChatError | null;
  moreLoad: Load;
  loadUsage: () => Promise<void>;
  loadItems: () => Promise<void>;
  loadMore: () => Promise<void>;
  setOrder: (order: MineOrder) => void;
  setOrigin: (origin: ConvId | null) => void;
  setMeter: (meter: Meter) => void;
  dropItems: (ids: MediaId[]) => void;
  dropAll: () => void;
  reload: () => Promise<void>;
}

let ticket = 0;

function errorOf(error: unknown): ChatError {
  return chatError(error) ?? { code: 'internal' };
}

function withoutItems(usage: MediaUsage, gone: MyMedia[]): MediaUsage {
  const bytesBy = new Map<ConvId, { bytes: number; files: number }>();
  for (const item of gone) {
    const row = bytesBy.get(item.conversation_id) ?? { bytes: 0, files: 0 };
    row.bytes += item.bytes;
    row.files += 1;
    bytesBy.set(item.conversation_id, row);
  }
  const conversations: ConversationUsage[] = [];
  for (const row of usage.conversations) {
    const minus = bytesBy.get(row.conversation_id);
    if (!minus) {
      conversations.push(row);
      continue;
    }
    const files = row.files - minus.files;
    if (files > 0) {
      conversations.push({ ...row, bytes: Math.max(0, row.bytes - minus.bytes), files });
    }
  }
  conversations.sort((a, b) => b.bytes - a.bytes);
  const freed = gone.reduce((sum, item) => sum + item.bytes, 0);
  return {
    ...usage,
    bytes: Math.max(0, usage.bytes - freed),
    files: Math.max(0, usage.files - gone.length),
    conversations,
  };
}

export const useStorageStore = create<StorageState>()((set, get) => {
  const fetchPage = async (cursor: string | null) => {
    const { order, origin } = get();
    return chatBridge.mediaMine({ order, conversationId: origin, cursor, limit: PAGE });
  };

  return {
    usage: null,
    usageLoad: 'idle',
    usageError: null,
    meter: null,
    order: 'new',
    origin: null,
    items: [],
    cursor: null,
    itemsLoad: 'idle',
    itemsError: null,
    moreLoad: 'idle',

    loadUsage: async () => {
      set({ usageLoad: get().usage ? 'ready' : 'loading', usageError: null });
      try {
        const usage = await chatBridge.mediaUsage();
        const meter = { used: usage.bytes + usage.reserved, quota: usage.quota };
        set({ usage, meter, usageLoad: 'ready' });
        syncUsed(meter.used, meter.quota, usage);
      } catch (error) {
        set({ usageLoad: 'failed', usageError: errorOf(error) });
      }
    },

    loadItems: async () => {
      const mine = ++ticket;
      set({ itemsLoad: 'loading', itemsError: null, moreLoad: 'idle' });
      try {
        const page = await fetchPage(null);
        if (mine !== ticket) return;
        set({ items: page.items, cursor: page.next_cursor, itemsLoad: 'ready' });
      } catch (error) {
        if (mine !== ticket) return;
        set({ itemsLoad: 'failed', itemsError: errorOf(error) });
      }
    },

    loadMore: async () => {
      const { cursor, moreLoad, itemsLoad } = get();
      if (!cursor || moreLoad === 'loading' || itemsLoad !== 'ready') return;
      const mine = ticket;
      set({ moreLoad: 'loading' });
      try {
        const page = await fetchPage(cursor);
        if (mine !== ticket) return;
        const known = new Set(get().items.map((item) => item.id));
        const fresh = page.items.filter((item) => !known.has(item.id));
        set({ items: [...get().items, ...fresh], cursor: page.next_cursor, moreLoad: 'ready' });
      } catch {
        if (mine === ticket) set({ moreLoad: 'failed' });
      }
    },

    setOrder: (order) => {
      if (order === get().order) return;
      set({ order, items: [], cursor: null });
      void get().loadItems();
    },

    setOrigin: (origin) => {
      if (origin === get().origin) return;
      set({ origin, items: [], cursor: null });
      void get().loadItems();
    },

    setMeter: (meter) => {
      set({ meter });
      syncUsed(meter.used, meter.quota, get().usage);
    },

    dropItems: (ids) => {
      const gone = new Set(ids);
      const { items, usage } = get();
      const dropped = items.filter((item) => gone.has(item.id));
      set({
        items: items.filter((item) => !gone.has(item.id)),
        usage: usage ? withoutItems(usage, dropped) : usage,
      });
    },

    dropAll: () => {
      ticket += 1;
      const { usage } = get();
      set({
        items: [],
        cursor: null,
        itemsLoad: 'ready',
        origin: null,
        usage: usage ? { ...usage, bytes: 0, reserved: 0, files: 0, conversations: [] } : usage,
      });
    },

    reload: async () => {
      await Promise.all([get().loadUsage(), get().loadItems()]);
    },
  };
});
