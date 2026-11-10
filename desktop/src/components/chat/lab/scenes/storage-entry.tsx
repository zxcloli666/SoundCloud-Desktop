import { CHAT_DOCK_MIN, DOCK_LIST, useChatPrefsStore } from '../../../../stores/chat/prefs';
import { storageWorld } from '../storage-world';
import type { LabKit, LabScene } from '../types';

const MIB = 1024 * 1024;
const BUTTON = '[data-ui="chat-storage-button"]';
const RING_DRAWN_MS = 1300;

function filled(kit: LabKit, base: number) {
  storageWorld(kit, { star: true, count: 24, base });
  kit.waitFor(BUTTON);
  kit.wait(RING_DRAWN_MS);
}

export const scenes: LabScene[] = [
  {
    id: 'storage-entry-page',
    title: 'Image storage button in the chats header',
    route: '/chats',
    setup: (kit) => filled(kit, 860 * MIB),
  },
  {
    id: 'storage-entry-dock',
    title: 'Image storage button in the narrowest dock',
    route: '/home',
    setup: (kit) => {
      useChatPrefsStore.getState().setDockWidth(CHAT_DOCK_MIN);
      kit.dock(DOCK_LIST);
      filled(kit, 300 * MIB);
    },
  },
  {
    id: 'storage-entry-full',
    title: 'Image storage button with the quota full',
    route: '/chats',
    setup: (kit) => filled(kit, 1024 * MIB),
  },
  {
    id: 'storage-entry-opens',
    title: 'The header button opens the image storage page',
    route: '/chats',
    setup: (kit) => {
      filled(kit, 300 * MIB);
      kit.click(BUTTON);
      kit.waitFor('[data-ui="chat-storage-grid"] [data-tile="0"]');
    },
  },
];
