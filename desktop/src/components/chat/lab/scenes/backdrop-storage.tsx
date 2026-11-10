import type { UploadView } from '../../../../lib/chat/media-types';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { CONV } from '../convs';
import { sleep } from '../steps';
import { never, storageWorld } from '../storage-world';
import type { LabKit, LabScene } from '../types';

const ROUTE = '/chats/room';
const TILE = '[data-ui="chat-backdrop-stored"]';
const FIRST = '[data-ui="chat-backdrop-stored-grid"] [data-tile="0"]';
const PAINTED_MS = 700;

function picker(kit: LabKit, count: number) {
  storageWorld(kit, { star: true, count });
  kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'aurora' } });
  kit.after(() => useBackdropStore.getState().open('picker'));
  kit.waitFor(TILE);
}

function sheet(kit: LabKit, count = 30) {
  picker(kit, count);
  kit.click(TILE);
  kit.waitFor(FIRST);
  kit.wait(PAINTED_MS);
}

function picked(kit: LabKit) {
  sheet(kit);
  kit.click(FIRST);
}

function uploading(): UploadView {
  return {
    id: 'u-backdrop-stored',
    album: 'a-backdrop-stored',
    position: 0,
    conversationId: CONV.room,
    kind: 'backdrop',
    state: 'uploading',
    object: 'image',
    partsSent: 9,
    imageBytes: 590_000,
    thumbBytes: 0,
    attempts: 1,
    updatedAt: Date.now(),
  };
}

export const scenes: LabScene[] = [
  {
    id: 'backdrop-storage-choice',
    title: 'Backdrop picker: from storage choice',
    route: ROUTE,
    setup: (kit) => picker(kit, 30),
  },
  {
    id: 'backdrop-storage-sheet',
    title: 'Backdrop picker: images from storage',
    route: ROUTE,
    setup: (kit) => {
      sheet(kit);
      kit.after(() => {
        const hovered = new MouseEvent('mouseover', { bubbles: true });
        document.querySelector(FIRST)?.dispatchEvent(hovered);
      });
      kit.wait(PAINTED_MS);
    },
  },
  {
    id: 'backdrop-storage-empty',
    title: 'Backdrop picker: nothing in storage yet',
    route: ROUTE,
    setup: (kit) => {
      picker(kit, 0);
      kit.click(TILE);
      kit.waitFor('[data-ui="chat-backdrop-stored-empty"]');
    },
  },
  {
    id: 'backdrop-storage-fetching',
    title: 'Backdrop picker: stored image on its way',
    route: ROUTE,
    setup: (kit) => {
      kit.handle('chat_room_backdrop_stored', () => never());
      picked(kit);
    },
  },
  {
    id: 'backdrop-storage-uploading',
    title: 'Backdrop picker: stored image uploading',
    route: ROUTE,
    setup: (kit) => {
      kit.handle('chat_room_backdrop_stored', async () => {
        await sleep(300);
        const view = uploading();
        kit.world.uploads = [view];
        return view;
      });
      picked(kit);
      kit.wait(600);
    },
  },
  {
    id: 'backdrop-storage-gone',
    title: 'Backdrop picker: stored image is gone',
    route: ROUTE,
    setup: (kit) => {
      kit.handle('chat_room_backdrop_stored', async (args) => {
        await sleep(300);
        throw { code: 'media_missing', ids: [args.mediaId] };
      });
      picked(kit);
      kit.waitFor('[role="alert"]');
    },
  },
];
