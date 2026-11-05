import type { UploadView } from '../../../lib/chat/media-types';
import type { ConversationSummary, Message, SendInput } from '../../../lib/chat/types';
import type { RoomView } from '../../../lib/together/types';
import { emitChat } from './bus';
import { mediaMark, pictureSize, thumbhashOf } from './pictures';
import { sleep } from './steps';
import { cancel, commit, enqueue, onUploadDone, retry, setUploads } from './uploads-sim';
import { world } from './world';

type Args = Record<string, unknown>;

const HOLD_MS = 450;
const FETCH_MS = 900;

let picks = 0;

export const cooldown: { until: number | null } = { until: null };

const parked = new Map<string, SendInput>();

function bytesOf(path: string): number {
  let h = 7;
  for (const ch of path) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return 300_000 + (h % 5_200_000);
}

function mediaOn() {
  const media = world.config.media;
  if (!media?.uploads) throw { code: 'media_uploads_paused' };
  return media;
}

function albumOf(args: Args): string {
  return (args.album as string | null) || `album-${Date.now().toString(36)}`;
}

function attach(conversationId: string, album: string, sizes: [string, number][]): UploadView[] {
  const media = mediaOn();
  const have = world.uploads.filter((u) => u.album === album).length;
  if (have + sizes.length > media.limits.albumMax) throw { code: 'invalid' };
  return sizes.map(([path, bytes], index) => {
    if (bytes > media.limits.imageMaxBytes) throw { code: 'invalid' };
    return enqueue(conversationId, album, 'image', path, bytes, have + index);
  });
}

function mediaAttach(args: Args): UploadView[] {
  const paths = (args.paths as string[]) ?? [];
  return attach(
    String(args.conversationId),
    albumOf(args),
    paths.map((path) => [path, bytesOf(path)]),
  );
}

function mediaAttachData(args: Args): UploadView[] {
  const data = args.data as Uint8Array | undefined;
  const bytes = data?.byteLength ?? bytesOf('pasted');
  return attach(String(args.conversationId), albumOf(args), [['pasted', bytes]]);
}

function attachments(album: string) {
  return world.uploads
    .filter((u) => u.album === album)
    .sort((a, b) => a.position - b.position)
    .map((u) => {
      const [w, h] = pictureSize(u.id);
      return {
        mediaId: u.id,
        kind: 'image' as const,
        size: u.imageBytes,
        w,
        h,
        thumbhash: thumbhashOf(u.id),
      };
    });
}

function albumReady(album: string): boolean {
  const rows = world.uploads.filter((u) => u.album === album);
  return rows.length > 0 && rows.every((u) => u.state === 'uploaded' || u.state === 'committed');
}

function pendingMessage(input: SendInput, album: string): Message {
  return {
    conversationId: input.conversationId,
    seq: null,
    clientId: album,
    sender: world.status.userId ?? 'u-me',
    senderDevice: null,
    mine: true,
    ts: Date.now(),
    editedAt: null,
    expiresAt: null,
    state: 'pending',
    body: { type: 'text', ...input.text },
    replyTo: input.replyTo ?? null,
    mentions: [],
    mentionsMe: false,
    embeds: input.embeds,
    attachments: [],
    forwardedFrom: null,
    reactions: [],
    pinned: false,
    localOnly: false,
  };
}

function replace(message: Message) {
  const thread = world.threads[message.conversationId] ?? [];
  const index = thread.findIndex((m) => m.clientId === message.clientId);
  if (index >= 0)
    world.threads[message.conversationId] = thread.map((m, i) => (i === index ? message : m));
  else world.threads[message.conversationId] = [...thread, message];
  emitChat('chat:messages', {
    conversationId: message.conversationId,
    origin: 'local',
    messages: [message],
  });
}

function release(album: string) {
  const input = parked.get(album);
  if (!input || !albumReady(album)) return;
  parked.delete(album);
  const rows = attachments(album);
  const ids = world.uploads.filter((u) => u.album === album).map((u) => u.id);
  for (const id of ids) commit(id);
  const seq = (world.threads[input.conversationId]?.length ?? 0) + 1;
  replace({ ...pendingMessage(input, album), seq, state: 'sent', attachments: rows });
  setTimeout(() => setUploads([], ids), HOLD_MS);
}

export function startMediaWrites() {
  onUploadDone((upload) => release(upload.album));
}

function mediaSend(args: Args): Message {
  const input = args.input as SendInput;
  const album = String(args.album);
  mediaOn();
  const message = pendingMessage(input, album);
  parked.set(album, input);
  replace(message);
  setTimeout(() => release(album), 0);
  return message;
}

function albumCancel(args: Args) {
  const album = String(args.album);
  parked.delete(album);
  for (const upload of world.uploads.filter((u) => u.album === album)) cancel(upload.id);
  return null;
}

function mediaAvatar(args: Args): UploadView {
  mediaOn();
  const conversationId = String(args.conversationId);
  const view = enqueue(
    conversationId,
    `avatar-${conversationId}`,
    'avatar',
    String(args.path),
    180_000,
  );
  const stop = onUploadDone((done) => {
    if (done.id !== view.id) return;
    stop();
    world.conversations = world.conversations.map((c) =>
      c.id === conversationId ? { ...c, avatarMediaId: done.id } : c,
    );
    const updated = world.conversations.find((c) => c.id === conversationId);
    if (updated) emitSummary(updated);
  });
  return view;
}

function emitSummary(summary: ConversationSummary) {
  emitChat('chat:sync', { reset: false, conversations: [summary], marks: [], requests: 0 });
}

async function patchRoom(change: (room: RoomView) => Partial<RoomView>) {
  const { useTogetherStore } = await import('../../../stores/together');
  const room = useTogetherStore.getState().room;
  if (!room) throw { code: 'not_found' };
  useTogetherStore.setState({
    room: { ...room, ...change(room), version: room.version + 1, serverNow: Date.now() },
  });
}

function needStar() {
  if (world.config.media?.star !== true) throw { code: 'room_star_required' };
}

function needIdle() {
  if (cooldown.until && cooldown.until > Date.now()) {
    throw { code: 'backdrop_cooldown', until: cooldown.until };
  }
}

function nextPick(conversationId: string) {
  picks += 1;
  const pending = world.uploads.filter(
    (u) => u.kind === 'backdrop' && u.conversationId === conversationId && u.state !== 'committed',
  );
  for (const upload of pending) cancel(upload.id);
  return picks;
}

async function roomBackdrop(args: Args) {
  needStar();
  needIdle();
  nextPick(String(args.conversationId));
  const preset = args.preset as string | null;
  await patchRoom(() => ({ backdrop: preset ? { kind: 'preset', id: preset } : null }));
  return null;
}

function backdropUpload(conversationId: string, code: string, path: string): UploadView {
  const view = enqueue(conversationId, `backdrop-${code}`, 'backdrop', path, 480_000);
  const stop = onUploadDone((done) => {
    if (done.id !== view.id) return;
    stop();
    void patchRoom(() => ({ backdrop: { kind: 'image', mediaId: done.id } }));
  });
  return view;
}

function roomBackdropUpload(args: Args): UploadView {
  mediaOn();
  needStar();
  needIdle();
  nextPick(String(args.conversationId));
  return backdropUpload(String(args.conversationId), String(args.code), String(args.path));
}

async function roomBackdropStored(args: Args): Promise<UploadView | null> {
  mediaOn();
  needStar();
  needIdle();
  const turn = nextPick(String(args.conversationId));
  const mediaId = String(args.mediaId);
  await sleep(FETCH_MS);
  if (turn !== picks) return null;
  const mark = mediaMark(mediaId);
  if (mark === 'deleted' || mark === 'lost') throw { code: 'media_missing', ids: [mediaId] };
  return backdropUpload(String(args.conversationId), String(args.code), mediaId);
}

function roomBackdropReport(args: Args) {
  const room = world.uploads.some((u) => u.id === args.mediaId);
  if (room) throw { code: 'invalid' };
  return null;
}

async function roomSettings(args: Args) {
  const patch = (args.patch ?? {}) as Partial<RoomView> & Record<string, unknown>;
  if (patch.cover) needStar();
  await patchRoom(() => {
    const change: Partial<RoomView> = {};
    if ('title' in patch) change.title = patch.title as string | null;
    if ('slowModeS' in patch) change.slowModeS = patch.slowModeS as number;
    if ('chatEnabled' in patch) change.chatEnabled = patch.chatEnabled as boolean;
    if ('links' in patch) change.links = patch.links as boolean;
    if ('cover' in patch) change.cover = patch.cover as RoomView['cover'];
    if ('roomImages' in patch) change.roomImages = patch.roomImages as RoomView['roomImages'];
    return change;
  });
  return null;
}

export const writeHandlers: Record<string, (args: Args) => unknown> = {
  chat_media_attach: mediaAttach,
  chat_media_attach_data: mediaAttachData,
  chat_media_send: mediaSend,
  chat_media_album_cancel: albumCancel,
  chat_media_avatar: mediaAvatar,
  chat_media_upload_retry: (args) => {
    retry(String(args.id));
    return null;
  },
  chat_media_upload_cancel: (args) => {
    cancel(String(args.id));
    return null;
  },
  chat_room_backdrop: roomBackdrop,
  chat_room_backdrop_upload: roomBackdropUpload,
  chat_room_backdrop_stored: roomBackdropStored,
  chat_room_backdrop_stop: (args) => {
    nextPick(String(args.conversationId));
    return null;
  },
  chat_room_backdrop_report: roomBackdropReport,
  chat_room_settings: roomSettings,
};
