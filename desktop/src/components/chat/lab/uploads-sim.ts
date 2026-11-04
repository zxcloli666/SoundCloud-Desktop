import type { MediaKind, UploadView } from '../../../lib/chat/media-types';
import type { ChatError } from '../../../lib/chat/types';
import { emitChat } from './bus';
import { pictureSize } from './pictures';
import { world } from './world';

const TICK_MS = 220;
const PART = 32 * 1024;
const PARTS_PER_TICK = 12;

export const faults: { upload: ChatError | null; failAfter: number } = {
  upload: null,
  failAfter: 0.4,
};

const timers = new Map<string, ReturnType<typeof setInterval>>();
const staged = new Set<string>();
const doneHooks = new Set<(upload: UploadView) => void>();

let counter = 0;

export function onUploadDone(hook: (upload: UploadView) => void): () => void {
  doneHooks.add(hook);
  return () => doneHooks.delete(hook);
}

export function setUploads(uploads: UploadView[], removed: string[] = []) {
  world.uploads = world.uploads.filter((u) => !removed.includes(u.id));
  for (const upload of uploads) {
    const index = world.uploads.findIndex((u) => u.id === upload.id);
    if (index >= 0) world.uploads[index] = upload;
    else world.uploads.push(upload);
  }
  emitChat('chat:media-uploads', { uploads, removed });
}

function patch(id: string, change: Partial<UploadView>): UploadView | null {
  const found = world.uploads.find((u) => u.id === id);
  if (!found) return null;
  const next = { ...found, ...change, updatedAt: Date.now() };
  setUploads([next]);
  return next;
}

function fail(id: string, error: ChatError) {
  stop(id);
  patch(id, {
    state: 'failed',
    attempts: (world.uploads.find((u) => u.id === id)?.attempts ?? 0) + 1,
  });
  emitChat('chat:media-upload-error', { id, error });
}

function stop(id: string) {
  const timer = timers.get(id);
  if (timer) clearInterval(timer);
  timers.delete(id);
}

function fileFault(path: string, upload: UploadView): ChatError | null {
  if (faults.upload) return faults.upload;
  const media = world.config.media;
  if (path.includes('quota') || (media && media.used + upload.imageBytes > media.quota)) {
    return { code: 'quota_exceeded', used: media?.used, quota: media?.quota };
  }
  if (path.includes('offline')) return { code: 'offline' };
  if (path.includes('fail')) return { code: 'protocol' };
  return null;
}

function run(id: string, path: string) {
  stop(id);
  let ticks = 0;
  timers.set(
    id,
    setInterval(() => {
      const upload = world.uploads.find((u) => u.id === id);
      if (!upload) return stop(id);
      ticks += 1;
      const total = Math.max(1, Math.ceil(upload.imageBytes / PART));
      const fault = fileFault(path, upload);
      if (fault && (ticks > 3 || fault.code === 'quota_exceeded')) return fail(id, fault);
      if (ticks === 1) return void patch(id, { state: 'reserved', object: 'thumb' });
      if (ticks === 2) return void patch(id, { state: 'uploading', object: 'thumb', partsSent: 1 });
      const sent = Math.min(total, (ticks - 2) * PARTS_PER_TICK);
      if (sent < total)
        return void patch(id, { state: 'uploading', object: 'image', partsSent: sent });
      stop(id);
      const finished = staged.has(id) ? 'uploaded' : 'committed';
      const done = patch(id, { state: finished, object: 'image', partsSent: total });
      if (done) for (const hook of doneHooks) hook(done);
    }, TICK_MS),
  );
}

export function enqueue(
  conversationId: string,
  album: string,
  kind: MediaKind,
  path: string,
  bytes: number,
  position = 0,
): UploadView {
  counter += 1;
  const id = `up-${Date.now().toString(36)}-${counter}`;
  const [w, h] = pictureSize(id);
  const view: UploadView = {
    id,
    album,
    position,
    conversationId,
    kind,
    state: 'queued',
    object: 'thumb',
    partsSent: 0,
    imageBytes: bytes,
    thumbBytes: Math.round(Math.min(40_000, (bytes * w) / (w + h) / 20)),
    attempts: 0,
    updatedAt: Date.now(),
  };
  if (kind === 'image') staged.add(id);
  setUploads([view]);
  run(id, path);
  return view;
}

export function retry(id: string) {
  const found = world.uploads.find((u) => u.id === id);
  if (!found) return;
  patch(id, { state: 'queued', object: 'thumb', partsSent: 0 });
  run(id, '');
}

export function cancel(id: string) {
  stop(id);
  staged.delete(id);
  setUploads([], [id]);
}

export function commit(id: string) {
  staged.delete(id);
  patch(id, { state: 'committed' });
}
