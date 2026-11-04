import type {
  ConversationUsage,
  MediaConfig,
  MediaUsage,
  MyMedia,
  UploadState,
  UploadView,
} from '../../../lib/chat/media-types';
import { CONV, NOW } from './convs';
import { setPictureSize } from './pictures';

const MB = 1024 * 1024;
const GB = 1024 * MB;
const DAY = 86_400_000;

export function labMediaConfig(star: boolean, used = star ? 3.4 * GB : 61 * MB): MediaConfig {
  return {
    uploads: true,
    star,
    quota: star ? 10 * GB : 100 * MB,
    used,
    limits: {
      imageMaxBytes: star ? 25 * MB : 8 * MB,
      thumbMaxBytes: 200 * 1024,
      avatarMaxBytes: 2 * MB,
      albumMax: 10,
      roomAlbumMax: 4,
      restoreWindowS: 7 * 86_400,
    },
  };
}

const USAGE_ROWS: [string, number, number][] = [
  [CONV.dm, 18 * MB, 14],
  [CONV.group, 31 * MB, 22],
  [CONV.self, 4 * MB, 3],
  ['c-gone', 8 * MB, 5],
];

export function labUsage(config: MediaConfig): MediaUsage {
  const conversations: ConversationUsage[] = USAGE_ROWS.map(([id, bytes, files]) => ({
    conversation_id: id,
    bytes: config.star ? bytes * 50 : bytes,
    files,
    gone: id === 'c-gone',
  }));
  return {
    bytes: config.used,
    reserved: Math.round(config.used * 0.02),
    quota: config.quota,
    files: conversations.reduce((sum, row) => sum + row.files, 0),
    conversations,
  };
}

export function labMine(): MyMedia[] {
  const out: MyMedia[] = [];
  for (let i = 0; i < 36; i++) {
    const id = `m-mine-${i}`;
    setPictureSize(id, 1000 + (i % 3) * 300, 900 + (i % 4) * 200);
    out.push({
      id,
      kind: i % 17 === 5 ? 'avatar' : 'image',
      conversation_id: [CONV.dm, CONV.group, CONV.self, 'c-gone'][i % 4],
      thumb_id: `${id}-t`,
      bytes: (120 + ((i * 53) % 900)) * 1024,
      status: i % 9 === 4 ? 'lost' : i % 5 === 0 ? 'uploaded' : 'attached',
      chats: i % 5 === 0 ? 0 : 1 + (i % 2),
      created_at: NOW - i * 0.6 * DAY,
    });
  }
  return out;
}

export function labUpload(id: string, state: UploadState, patch: Partial<UploadView> = {}) {
  const view: UploadView = {
    id,
    album: 'album-lab',
    position: 0,
    conversationId: CONV.dm,
    kind: 'image',
    state,
    object: state === 'queued' ? 'thumb' : 'image',
    partsSent: state === 'uploading' ? 14 : 0,
    imageBytes: 2_300_000,
    thumbBytes: 40_000,
    attempts: state === 'failed' ? 3 : 0,
    updatedAt: NOW,
    ...patch,
  };
  setPictureSize(id, 1600, 1000);
  return view;
}

export function labUploadSet(conversationId: string): UploadView[] {
  const states: UploadState[] = ['queued', 'uploading', 'uploaded', 'committed', 'failed'];
  return states.map((state, index) =>
    labUpload(`up-${index}`, state, { conversationId, position: index }),
  );
}
