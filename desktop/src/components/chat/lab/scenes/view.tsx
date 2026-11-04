import i18n from 'i18next';
import type { MessageAttachment, UploadView } from '../../../../lib/chat/media-types';
import type { ConvId, Message, Seq } from '../../../../lib/chat/types';
import { emitChat } from '../bus';
import { CONV, NOW } from '../convs';
import { labUpload } from '../media-data';
import { attachment } from '../messages';
import { ME_ID } from '../people';
import type { LabKit, LabScene } from '../types';

const MIN = 60_000;
const AUTO_RETRIES_MS = 23_000;
const SIZES: [number, number][] = [
  [1600, 1000],
  [900, 1200],
  [1200, 1200],
  [1920, 1080],
  [1000, 1500],
  [1400, 1000],
  [1080, 1920],
  [1300, 900],
  [1000, 1250],
  [1500, 1000],
];
const PENDING_URL = 'http://127.0.0.1:5393/chat-lab-pending.webp';

type LabMedia = (conversationId: ConvId, mediaId: string, variant: string) => string | null;
type Emit = (event: string, payload: unknown) => void;

function album(prefix: string, count: number, shift = 0): MessageAttachment[] {
  return Array.from({ length: count }, (_, index) => {
    const [w, h] = SIZES[(index + shift) % SIZES.length];
    return attachment(`${prefix}-${index + 1}`, w, h);
  });
}

interface Post {
  from?: string;
  ago: number;
  text?: string;
  attachments?: MessageAttachment[];
  pending?: string;
}

function thread(conv: ConvId, posts: Post[]): Message[] {
  return posts.map((post, index) => {
    const from = post.from ?? ME_ID;
    const mine = from === ME_ID;
    return {
      conversationId: conv,
      seq: post.pending ? null : index + 1,
      clientId: post.pending ?? `${conv}-view-${index + 1}`,
      sender: from,
      senderDevice: null,
      mine,
      ts: NOW - post.ago * MIN,
      editedAt: null,
      expiresAt: null,
      state: post.pending ? 'pending' : mine ? 'read' : 'delivered',
      body: { type: 'text', text: post.text ?? '', spans: [] },
      replyTo: null,
      mentions: [],
      mentionsMe: false,
      embeds: [],
      attachments: post.attachments ?? [],
      forwardedFrom: null,
      reactions: [],
      pinned: false,
      localOnly: false,
    };
  });
}

function seedThread(kit: LabKit, conv: ConvId, posts: Post[]) {
  const messages = thread(conv, posts);
  kit.world.threads[conv] = messages;
  kit.handle('chat_history', (args) => {
    const query = args.query as { before?: Seq | null; limit: number };
    const all = (kit.world.threads[String(args.conversationId)] ?? []).filter(
      (message) => message.seq !== null,
    );
    const older = all.filter(
      (message) => query.before == null || (message.seq ?? 0) < query.before,
    );
    const page = older.slice(Math.max(0, older.length - query.limit));
    return { messages: page, more: page.length < older.length };
  });
}

function emit(event: string, payload: unknown) {
  (emitChat as unknown as Emit)(event, payload);
}

function markState(kit: LabKit, ids: string[], state: 'deleted' | 'lost', conv: ConvId) {
  kit.mark(ids, state);
  kit.waitFor('[data-ui="chat-album"]');
  kit.after(() => {
    for (const mediaId of ids) emit('chat:media-state', { conversationId: conv, mediaId, state });
  });
}

function openInfoGallery(kit: LabKit) {
  kit.waitFor('[data-ui="chat-thread-header"]');
  kit.after(() => {
    const label = i18n.t('chat.thread.menu.info');
    document.querySelector<HTMLElement>(`[aria-label="${label}"]`)?.click();
  });
  kit.waitFor('[data-ui="chat-info"] [role="tab"]');
  kit.click('[data-ui="chat-info"] [role="tablist"] > [role="tab"]:last-child');
  kit.wait(300);
  kit.after(() => {
    const tabs = document.querySelector<HTMLElement>('[data-ui="chat-info"] [role="tablist"]');
    const scroller = tabs?.parentElement;
    if (tabs && scroller) scroller.scrollTop = tabs.offsetTop - 8;
  });
}

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

function upload(
  id: string,
  album: string,
  position: number,
  state: UploadView['state'],
  patch: Partial<UploadView> = {},
) {
  return labUpload(id, state, { album, position, conversationId: CONV.dm, ...patch });
}

const ROUTE_DM = `/chats/${CONV.dm}`;
const ROUTE_GROUP = `/chats/${CONV.group}`;

export const scenes: LabScene[] = [
  {
    id: 'view-albums-1-2-3',
    title: 'Albums of 1, 2 and 3',
    route: ROUTE_DM,
    setup: (kit) =>
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 50, attachments: album('m-v1', 1) },
        { ago: 40, text: 'Вид с крыши вчера', attachments: album('m-v2', 2, 1) },
        { from: 'u-mira', ago: 30, text: 'А у нас так', attachments: album('m-v3', 3, 4) },
      ]),
  },
  {
    id: 'view-albums-4-7',
    title: 'Albums of 4 and 7',
    route: ROUTE_DM,
    setup: (kit) =>
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 50, attachments: album('m-v4', 4, 2) },
        { ago: 20, text: 'Вся поездка одним альбомом', attachments: album('m-v7', 7) },
      ]),
  },
  {
    id: 'view-album-10',
    title: 'Album of 10',
    route: ROUTE_DM,
    setup: (kit) =>
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 90, text: 'Покажи фестиваль' },
        { ago: 20, text: 'Десять лучших кадров с фестиваля', attachments: album('m-v10', 10, 3) },
      ]),
  },
  {
    id: 'view-loading',
    title: 'Album loading',
    route: ROUTE_DM,
    setup: (kit) => {
      const lab = window as { __chatLabMedia?: LabMedia };
      const original = lab.__chatLabMedia;
      lab.__chatLabMedia = (conv, mediaId, variant) =>
        mediaId.startsWith('m-load') && variant === 'thumb'
          ? PENDING_URL
          : (original?.(conv, mediaId, variant) ?? null);
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 30, text: 'Лови', attachments: album('m-load', 4, 1) },
      ]);
    },
  },
  {
    id: 'view-failed',
    title: 'Album failed to load',
    route: ROUTE_DM,
    setup: (kit) => {
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 30, text: 'Лови', attachments: album('m-fail', 3, 1) },
      ]);
      kit.mark(['m-fail-1', 'm-fail-2', 'm-fail-3'], 'failed');
      kit.wait(AUTO_RETRIES_MS);
    },
  },
  {
    id: 'view-gone',
    title: 'Deleted, lost and failed tiles',
    route: ROUTE_DM,
    setup: (kit) => {
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 40, attachments: album('m-gone1', 1, 2) },
        { from: 'u-mira', ago: 20, text: 'Старый альбом', attachments: album('m-gone', 4) },
      ]);
      kit.mark(['m-gone-3', 'm-gone1-1'], 'failed');
      markState(kit, ['m-gone-1'], 'deleted', CONV.dm);
      markState(kit, ['m-gone-2'], 'lost', CONV.dm);
      kit.wait(AUTO_RETRIES_MS);
    },
  },
  {
    id: 'view-pending',
    title: 'Pending albums with progress',
    route: ROUTE_DM,
    setup: (kit) => {
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 30, text: 'Жду фотки!' },
        { ago: 2, text: 'Отправляю всё с дачи', pending: 'album-a' },
        { ago: 1, pending: 'album-b' },
      ]);
      kit.uploads([
        upload('up-a1', 'album-a', 0, 'committed'),
        upload('up-a2', 'album-a', 1, 'uploading', { partsSent: 40 }),
        upload('up-a3', 'album-a', 2, 'uploading', { object: 'thumb', partsSent: 1 }),
        upload('up-a4', 'album-a', 3, 'queued'),
        upload('up-b1', 'album-b', 0, 'uploaded'),
        upload('up-b2', 'album-b', 1, 'failed', { partsSent: 20 }),
      ]);
      kit.waitFor('[data-ui="chat-upload-tile"]');
      kit.after(() =>
        emit('chat:media-upload-error', { id: 'up-b2', error: { code: 'quota_exceeded' } }),
      );
    },
  },
  {
    id: 'view-parked',
    title: 'Parked album before the upload queue loads',
    route: ROUTE_DM,
    setup: (kit) => {
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 30, text: 'Жду фотки!' },
        { ago: 1, text: 'Ещё три', pending: 'album-p', attachments: album('up-p', 3, 1) },
      ]);
      kit.handle('chat_media_parked', () => ['album-p']);
      kit.waitFor('[data-ui="chat-upload-tile"]');
    },
  },
  {
    id: 'view-lightbox',
    title: 'Lightbox',
    route: ROUTE_DM,
    setup: (kit) => {
      seedThread(kit, CONV.dm, [
        { from: 'u-mira', ago: 80, attachments: album('m-lb0', 1, 5) },
        { ago: 20, text: 'Вся поездка одним альбомом', attachments: album('m-lb', 7) },
      ]);
      kit.waitFor('[data-ui="chat-album-tile"]');
      kit.click(
        '[data-ui="chat-album"]:has([data-ui="chat-album-tile"]:nth-child(7)) > :nth-child(3)',
      );
      kit.waitFor('[data-ui="chat-lightbox"]');
      kit.wait(400);
    },
  },
  {
    id: 'view-lightbox-zoom',
    title: 'Lightbox zoomed',
    route: ROUTE_DM,
    setup: (kit) => {
      seedThread(kit, CONV.dm, [
        { ago: 20, text: 'Посмотри детали', attachments: album('m-lbz', 2, 3) },
      ]);
      kit.waitFor('[data-ui="chat-album-tile"]');
      kit.click('[data-ui="chat-album-tile"]');
      kit.waitFor('[data-ui="chat-lightbox"]');
      kit.wait(300);
      kit.after(() => {
        press('+');
        press('+');
      });
      kit.wait(400);
    },
  },
  {
    id: 'view-gallery',
    title: 'Gallery tab',
    route: ROUTE_GROUP,
    setup: (kit) => {
      seedThread(kit, CONV.group, [
        { from: 'u-sasha', ago: 900, text: 'Прошлое лето', attachments: album('m-gal1', 5) },
        { from: 'u-kai', ago: 700, text: 'Кто едет в субботу?' },
        { ago: 500, attachments: album('m-gal2', 3, 2) },
        { from: 'u-mira', ago: 300, text: 'Закат', attachments: album('m-gal3', 1, 3) },
        { from: 'u-danil', ago: 200, attachments: album('m-gal4', 6, 4) },
        { ago: 100, text: 'Фото с прошлого раза', attachments: album('m-gal5', 4, 1) },
      ]);
      kit.mark(['m-gal2-2'], 'deleted');
      openInfoGallery(kit);
      kit.waitFor('[data-ui="chat-gallery"]');
      kit.after(() =>
        emit('chat:media-state', {
          conversationId: CONV.group,
          mediaId: 'm-gal2-2',
          state: 'deleted',
        }),
      );
    },
  },
  {
    id: 'view-gallery-empty',
    title: 'Gallery tab empty',
    route: ROUTE_GROUP,
    setup: (kit) => {
      seedThread(kit, CONV.group, [
        { from: 'u-sasha', ago: 400, text: 'Кто едет на дачу в субботу?' },
        { from: 'u-kai', ago: 380, text: 'Я за. Беру колонку' },
      ]);
      openInfoGallery(kit);
      kit.waitFor('[data-ui="chat-gallery-empty"]');
    },
  },
  {
    id: 'view-gallery-lightbox',
    title: 'Lightbox from the gallery',
    route: ROUTE_GROUP,
    setup: (kit) => {
      seedThread(kit, CONV.group, [
        { from: 'u-sasha', ago: 300, attachments: album('m-gl1', 3) },
        { from: 'u-mira', ago: 100, text: 'Закат', attachments: album('m-gl2', 4, 2) },
      ]);
      openInfoGallery(kit);
      kit.waitFor('[data-ui="chat-gallery-tile"]');
      kit.click('[data-ui="chat-gallery-tile"]');
      kit.waitFor('[data-ui="chat-lightbox"]');
      kit.wait(400);
    },
  },
];
