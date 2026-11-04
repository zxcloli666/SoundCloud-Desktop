import type { RoomBackdrop, UploadView } from '../../../../lib/chat/media-types';
import type { RoomView } from '../../../../lib/together/types';
import { useBackdropStore } from '../../../../stores/chat/backdrop';
import { useTogetherStore } from '../../../../stores/together';
import { PRESETS } from '../../room/presets';
import { CONV } from '../convs';
import type { LabKit, LabScene } from '../types';

const IMAGE_ID = 'm-backdrop-1';
const ROUTE = '/chats/room';

function patchRoom(patch: Partial<RoomView>) {
  const room = useTogetherStore.getState().room;
  if (room) useTogetherStore.setState({ room: { ...room, ...patch, version: room.version + 1 } });
}

function liveSettings(kit: LabKit) {
  kit.handle('chat_room_backdrop', (args) => {
    const id = args.preset;
    const backdrop: RoomBackdrop | null = typeof id === 'string' ? { kind: 'preset', id } : null;
    setTimeout(() => patchRoom({ backdrop }), 350);
    return null;
  });
}

function upload(patch: Partial<UploadView>): UploadView {
  return {
    id: 'u-backdrop-1',
    album: 'a-backdrop-1',
    position: 0,
    conversationId: CONV.room,
    kind: 'backdrop',
    state: 'uploading',
    object: 'image',
    partsSent: 11,
    imageBytes: 590_000,
    thumbBytes: 0,
    attempts: 1,
    updatedAt: Date.now(),
    ...patch,
  };
}

function openPicker(kit: LabKit) {
  kit.after(() => useBackdropStore.getState().open('picker'));
  kit.waitFor('[data-tile]');
}

const presetScenes: LabScene[] = PRESETS.map((preset) => ({
  id: `backdrop-${preset.id}`,
  title: `Backdrop: ${preset.id}`,
  route: ROUTE,
  setup: (kit) => {
    kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: preset.id } });
    liveSettings(kit);
  },
}));

export const scenes: LabScene[] = [
  ...presetScenes,
  {
    id: 'backdrop-image',
    title: 'Backdrop: member on an image',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: false, backdrop: { kind: 'image', mediaId: IMAGE_ID } });
      kit.after(() => useBackdropStore.getState().show(CONV.room, IMAGE_ID));
    },
  },
  {
    id: 'backdrop-hidden',
    title: 'Backdrop: image hidden locally',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: false, backdrop: { kind: 'image', mediaId: IMAGE_ID } });
      kit.after(() => useBackdropStore.getState().hide(CONV.room, IMAGE_ID));
    },
  },
  {
    id: 'backdrop-report',
    title: 'Backdrop: report dialog',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: false, backdrop: { kind: 'image', mediaId: IMAGE_ID } });
      kit.handle('chat_room_backdrop_report', () => null);
      kit.after(() => {
        useBackdropStore.getState().show(CONV.room, IMAGE_ID);
        useBackdropStore.getState().open('report');
      });
    },
  },
  {
    id: 'backdrop-picker-star',
    title: 'Backdrop picker: STAR host',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'aurora' } });
      liveSettings(kit);
      openPicker(kit);
    },
  },
  {
    id: 'backdrop-picker-free',
    title: 'Backdrop picker: free host',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: false, host: true });
      openPicker(kit);
    },
  },
  {
    id: 'backdrop-picker-cooldown',
    title: 'Backdrop picker: photo cooldown',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'dunes' } });
      liveSettings(kit);
      kit.after(() => patchRoom({ backdropCooldownUntil: Date.now() + 42 * 60_000 }));
      openPicker(kit);
    },
  },
  {
    id: 'backdrop-picker-uploading',
    title: 'Backdrop picker: uploading',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'satin' } });
      kit.uploads([upload({})]);
      openPicker(kit);
    },
  },
  {
    id: 'backdrop-picker-error',
    title: 'Backdrop picker: upload failed',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'satin' } });
      kit.uploads([upload({ state: 'failed', partsSent: 4 })]);
      kit.after(() =>
        kit.emit('chat:media-upload-error', {
          id: 'u-backdrop-1',
          error: { code: 'quota_exceeded', used: 1, quota: 1 },
        }),
      );
      openPicker(kit);
    },
  },
  {
    id: 'backdrop-picker-refused',
    title: 'Backdrop picker: photo refused after upload',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'vinyl' } });
      kit.after(() => {
        useBackdropStore.getState().started(CONV.room, 'u-backdrop-2');
        kit.emit('chat:media-upload-error', {
          id: 'u-backdrop-2',
          error: { code: 'backdrop_cooldown', until: Date.now() + 42 * 60_000 },
        });
      });
      openPicker(kit);
    },
  },
  {
    id: 'backdrop-chip',
    title: 'Backdrop: upload chip in the room',
    route: ROUTE,
    setup: (kit) => {
      kit.room({ star: true, host: true, backdrop: { kind: 'preset', id: 'pastel-lake' } });
      kit.uploads([upload({ partsSent: 12 })]);
    },
  },
];
