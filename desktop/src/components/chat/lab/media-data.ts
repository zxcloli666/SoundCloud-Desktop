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

const GIB = 1073741824;
const BLOCK = 4096;
const DAY = 86_400_000;
const RESERVED = 4 * BLOCK * 16;

export function labMediaConfig(star: boolean, used = 0): MediaConfig {
  return {
    uploads: true,
    star,
    quota: GIB,
    used,
    limits: {
      imageMaxBytes: 614400,
      thumbMaxBytes: 32768,
      avatarMaxBytes: 65536,
      albumMax: 10,
      roomAlbumMax: 4,
      restoreWindowS: 15,
    },
  };
}

export function labUsage(mine: MyMedia[], reserved = RESERVED): MediaUsage {
  const live = mine.filter((item) => item.status !== 'lost');
  const rows = new Map<string, ConversationUsage>();
  for (const item of live) {
    const row = rows.get(item.conversation_id) ?? {
      conversation_id: item.conversation_id,
      bytes: 0,
      files: 0,
      gone: item.conversation_id === 'c-gone',
    };
    row.bytes += item.bytes;
    row.files += 1;
    rows.set(item.conversation_id, row);
  }
  return {
    bytes: live.reduce((sum, item) => sum + item.bytes, 0),
    reserved,
    quota: GIB,
    files: live.length,
    conversations: [...rows.values()].sort((a, b) => b.bytes - a.bytes),
  };
}

export function labMine(): MyMedia[] {
  const out: MyMedia[] = [];
  for (let i = 0; i < 36; i++) {
    const id = `m-mine-${i}`;
    const avatar = i % 17 === 5;
    setPictureSize(id, avatar ? 512 : 1000 + (i % 3) * 300, avatar ? 512 : 900 + (i % 4) * 200);
    const blocks = avatar ? 4 + (i % 12) : 12 + ((i * 37) % 139);
    out.push({
      id,
      kind: avatar ? 'avatar' : 'image',
      conversation_id: [CONV.dm, CONV.group, CONV.self, 'c-gone'][i % 4],
      thumb_id: avatar ? null : `${id}-t`,
      bytes: blocks * BLOCK,
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
