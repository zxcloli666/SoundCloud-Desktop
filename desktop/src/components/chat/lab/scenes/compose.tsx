import type { UploadState, UploadView } from '../../../../lib/chat/media-types';
import { DOCK_LIST } from '../../../../stores/chat/prefs';
import { LAB_DRAG } from '../../media/compose/useImageDrop';
import { CONV } from '../convs';
import { labUpload } from '../media-data';
import type { LabKit, LabScene } from '../types';

const ATTACH = '[data-ui="chat-attach"]';
const STAGED = 'album-staged';
const SENT = 'album-sent';

function album(
  album: string,
  conversationId: string,
  states: UploadState[],
  prefix: string,
): UploadView[] {
  return states.map((state, position) =>
    labUpload(`${prefix}-${position}`, state, {
      album,
      conversationId,
      position,
      partsSent: state === 'uploading' ? 20 + position * 18 : 0,
      updatedAt: Date.now() - (states.length - position) * 1000,
    }),
  );
}

function paused(kit: LabKit) {
  kit.star(true);
  const media = kit.world.config.media;
  if (media) kit.world.config = { ...kit.world.config, media: { ...media, uploads: false } };
}

function drag(paths: string[] | null) {
  window.dispatchEvent(new CustomEvent(LAB_DRAG, { detail: { paths } }));
}

export const scenes: LabScene[] = [
  {
    id: 'compose-locked',
    title: 'Attach: STAR preview for a free user',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(false);
      kit.waitFor(ATTACH);
      kit.click(ATTACH);
    },
  },
  {
    id: 'compose-paused',
    title: 'Attach: uploads paused',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      paused(kit);
      kit.waitFor(ATTACH);
      kit.click(ATTACH);
    },
  },
  {
    id: 'compose-room-mods',
    title: 'Attach: room images for mods only',
    route: '/chats/room',
    setup: (kit) => {
      kit.star(true);
      kit.room({ star: true, host: false, roomImages: 'mods' });
      kit.waitFor(ATTACH);
      kit.click(ATTACH);
    },
  },
  {
    id: 'compose-staged',
    title: 'Staged album uploading',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      kit.uploads(
        album(
          STAGED,
          CONV.group,
          ['uploaded', 'uploaded', 'uploading', 'uploading', 'queued'],
          'st',
        ),
      );
    },
  },
  {
    id: 'compose-failed',
    title: 'Staged album with a failed image',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      const views = album(STAGED, CONV.group, ['uploaded', 'failed', 'uploading'], 'sf');
      kit.uploads(views);
      kit.after(() =>
        kit.emit('chat:media-upload-error', {
          id: views[1].id,
          error: { code: 'quota_exceeded', used: 1_073_000_000, quota: 1_073_741_824 },
        }),
      );
    },
  },
  {
    id: 'compose-full',
    title: 'Staged album full',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => {
      kit.star(true);
      kit.uploads(album(STAGED, CONV.dm, Array(10).fill('uploaded'), 'fu'));
    },
  },
  {
    id: 'compose-tray',
    title: 'Upload tray expanded in the dock',
    route: '/home',
    setup: (kit) => {
      kit.star(true);
      const views = [
        ...album(SENT, CONV.dm, ['committed', 'uploading', 'queued', 'failed'], 'tr'),
        labUpload('tr-avatar', 'uploading', {
          album: 'album-avatar',
          conversationId: CONV.group,
          kind: 'avatar',
          object: 'image',
          thumbBytes: 0,
          imageBytes: 60_000,
          partsSent: 1,
        }),
      ];
      kit.uploads(views);
      kit.dock(DOCK_LIST);
      kit.after(() =>
        kit.emit('chat:media-upload-error', { id: views[3].id, error: { code: 'offline' } }),
      );
      kit.waitFor('[data-ui="chat-upload-tray"] button');
      kit.click('[data-ui="chat-upload-tray"] button');
    },
  },
  {
    id: 'compose-drop',
    title: 'Drop overlay over the thread',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      kit.waitFor('[data-ui="chat-composer"]');
      kit.after(() => drag(['/tmp/a.png', '/tmp/b.jpg', '/tmp/c.webp']));
    },
  },
  {
    id: 'compose-drop-locked',
    title: 'Drop overlay for a free user',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(false);
      kit.waitFor('[data-ui="chat-composer"]');
      kit.after(() => drag(['/tmp/a.png']));
    },
  },
  {
    id: 'compose-skipped',
    title: 'Some picked files skipped',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      kit.uploads(album(STAGED, CONV.group, ['uploaded', 'uploading'], 'sk'));
      kit.after(async () => {
        const { useChatMediaStore } = await import('../../../../stores/chat/media');
        useChatMediaStore.getState().setSkipped(CONV.group, [
          { name: 'notes.pdf', reason: 'type', error: null },
          { name: 'IMG_2041.heic', reason: 'type', error: null },
          { name: 'panorama.png', reason: 'invalid', error: null },
        ]);
      });
    },
  },
  {
    id: 'compose-avatar',
    title: 'Group avatar uploading',
    route: `/chats/${CONV.group}`,
    setup: (kit) => {
      kit.star(true);
      kit.uploads([
        labUpload('av-1', 'uploading', {
          album: 'album-avatar',
          conversationId: CONV.group,
          kind: 'avatar',
          object: 'image',
          thumbBytes: 0,
          imageBytes: 60_000,
          partsSent: 1,
        }),
      ]);
      kit.waitFor('[data-ui="chat-thread-header"] button.flex-1');
      kit.click('[data-ui="chat-thread-header"] button.flex-1');
    },
  },
];
