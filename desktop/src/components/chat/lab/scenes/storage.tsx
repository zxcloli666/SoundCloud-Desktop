import i18n from 'i18next';
import { waitUntil } from '../steps';
import { never, storageWorld, typeInto } from '../storage-world';
import type { LabScene } from '../types';

const ROUTE = '/chats/storage';
const TILE = (index: number) => `[data-ui="chat-storage-grid"] [data-tile="${index}"]`;

export function openChatSettings() {
  const label = i18n.t('chat.settings.title');
  const items = document.querySelectorAll<HTMLElement>('[data-ui="settings-nav-item"]');
  const item = [...items].find((node) => node.textContent?.trim() === label);
  item?.click();
}

const STILL_POLLS = 4;

export async function scrollSettled() {
  const main = document.querySelector('main');
  let last = Number.NaN;
  let still = 0;
  await waitUntil(() => {
    const top = main?.scrollTop ?? 0;
    still = top === last ? still + 1 : 0;
    last = top;
    return still >= STILL_POLLS;
  }, 3000);
}

export const scenes: LabScene[] = [
  {
    id: 'storage-full',
    title: 'Storage: page full',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, {
        star: true,
        count: 560,
        base: 96 * 1024 * 1024,
        reserved: 2 * 1024 * 1024,
      });
      kit.waitFor(TILE(0));
    },
  },
  {
    id: 'storage-warm',
    title: 'Storage: near the cap',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 240, base: 860 * 1024 * 1024 });
      kit.waitFor(TILE(0));
    },
  },
  {
    id: 'storage-cap',
    title: 'Storage: quota full',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 200, base: 1024 * 1024 * 1024 });
      kit.waitFor(TILE(0));
    },
  },
  {
    id: 'storage-select',
    title: 'Storage: selection with confirm',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 560, base: 96 * 1024 * 1024 });
      kit.click(TILE(0));
      kit.click(TILE(2));
      kit.click(TILE(3));
      kit.click(TILE(7));
      kit.click('[data-ui="chat-storage-delete"]');
      kit.waitFor('[data-ui="chat-storage-confirm"]');
    },
  },
  {
    id: 'storage-undo',
    title: 'Storage: undo toast counting',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 560, base: 96 * 1024 * 1024 });
      kit.click(TILE(1));
      kit.click(TILE(4));
      kit.click(TILE(5));
      kit.click('[data-ui="chat-storage-delete"]');
      kit.click('[data-ui="chat-storage-confirm-delete"]');
      kit.waitFor('[data-ui="chat-storage-undo"]');
      kit.wait(2600);
    },
  },
  {
    id: 'storage-delete-all',
    title: 'Storage: delete all typed confirm',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 560, base: 96 * 1024 * 1024 });
      kit.click('[data-ui="chat-storage-delete-all-open"]');
      kit.waitFor('[data-ui="chat-storage-delete-all"] input');
      kit.wait(300);
      kit.after(() =>
        typeInto(
          '[data-ui="chat-storage-delete-all"] input',
          i18n.t('chat.storage.deleteAll.word'),
        ),
      );
    },
  },
  {
    id: 'storage-empty',
    title: 'Storage: empty',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 0 });
      kit.waitFor('[data-ui="chat-storage-empty"]');
    },
  },
  {
    id: 'storage-loading',
    title: 'Storage: loading',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 0 });
      kit.handle('chat_media_usage', never);
      kit.handle('chat_media_mine', never);
      kit.handle('chat_media_cache_size', never);
    },
  },
  {
    id: 'storage-error',
    title: 'Storage: error',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 0 });
      kit.handle('chat_media_usage', () => Promise.reject({ code: 'offline' }));
      kit.handle('chat_media_mine', () => Promise.reject({ code: 'offline' }));
      kit.waitFor('[data-ui="chat-storage-error"]');
    },
  },
  {
    id: 'storage-limited',
    title: 'Storage: rate limited',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 0 });
      kit.handle('chat_media_usage', () => Promise.reject({ code: 'read_limited' }));
      kit.handle('chat_media_mine', () => Promise.reject({ code: 'read_limited' }));
      kit.waitFor('[data-ui="chat-storage-error"]');
    },
  },
  {
    id: 'storage-free',
    title: 'Storage: free user, STAR preview',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: false, count: 0 });
      kit.waitFor('[data-ui="chat-storage-star"]');
    },
  },
  {
    id: 'storage-lapsed',
    title: 'Storage: lapsed STAR',
    route: ROUTE,
    setup: (kit) => {
      storageWorld(kit, { star: false, count: 140, base: 210 * 1024 * 1024 });
      kit.waitFor('[data-ui="chat-storage-lapsed"]');
    },
  },
  {
    id: 'storage-entry',
    title: 'Storage: settings entry',
    route: '/settings',
    setup: (kit) => {
      storageWorld(kit, { star: true, count: 560, base: 96 * 1024 * 1024 });
      kit.waitFor('[data-ui="settings-nav-item"]');
      kit.after(openChatSettings);
      kit.waitFor('[data-ui="chat-storage-entry"]');
      kit.after(async () => {
        await document.fonts.ready;
        await scrollSettled();
        document
          .querySelector('[data-ui="chat-storage-entry"]')
          ?.scrollIntoView({ block: 'center' });
      });
    },
  },
];
