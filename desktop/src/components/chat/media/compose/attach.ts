import { chatBridge } from '../../../../lib/chat/bridge';
import { chatError } from '../../../../lib/chat/errors';
import { isImagePath } from '../../../../lib/chat/image-files';
import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { type Skipped, useChatMediaStore } from '../../../../stores/chat/media';
import { stagedNow } from './staged';

const queues = new Map<ConvId, Promise<unknown>>();

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function queued<T>(conversationId: ConvId, job: () => Promise<T>): Promise<T> {
  const before = queues.get(conversationId) ?? Promise.resolve();
  const run = before.then(job, job);
  queues.set(
    conversationId,
    run.catch(() => undefined),
  );
  return run;
}

const STOPS: ReadonlySet<string> = new Set([
  'store',
  'crypto',
  'internal',
  'disabled',
  'media_star_required',
  'media_uploads_paused',
  'quota_exceeded',
  'room_star_required',
  'not_member',
  'unavailable',
]);

function skipOf(name: string, error: unknown): { skip: Skipped; stop: boolean } {
  const chat = chatError(error);
  const single = !chat || chat.code === 'invalid' || chat.code === 'not_found';
  return {
    skip: { name, reason: single ? 'invalid' : 'failed', error: chat },
    stop: chat !== null && STOPS.has(chat.code),
  };
}

interface Job {
  name: string;
  add: (album: string | null) => Promise<UploadView[]>;
}

async function runJobs(conversationId: ConvId, jobs: Job[], max: number): Promise<Skipped[]> {
  const media = useChatMediaStore.getState();
  const staged = stagedNow(conversationId);
  const album = staged[0]?.album ?? null;
  const room = Math.max(0, max - staged.length);
  const skipped: Skipped[] = jobs
    .slice(room)
    .map((job): Skipped => ({ name: job.name, reason: 'full', error: null }));
  const taken = jobs.slice(0, room);
  let current = album;
  let left = taken.length;
  media.setPreparing(conversationId, left);
  let stop: Skipped | null = null;
  for (const job of taken) {
    if (stop) {
      skipped.push({ ...stop, name: job.name });
      continue;
    }
    try {
      const added = await job.add(current);
      current = added[0]?.album ?? current;
      media.applyUploads({ uploads: added, removed: [] });
    } catch (error) {
      const refused = skipOf(job.name, error);
      skipped.push(refused.skip);
      if (refused.stop) stop = refused.skip;
    }
    left -= 1;
    media.setPreparing(conversationId, stop ? 0 : left);
  }
  media.setPreparing(conversationId, 0);
  return skipped;
}

export function attachPaths(conversationId: ConvId, paths: string[], max: number): Promise<void> {
  return queued(conversationId, async () => {
    const images = paths.filter(isImagePath);
    const wrong: Skipped[] = paths
      .filter((path) => !isImagePath(path))
      .map((path): Skipped => ({ name: fileName(path), reason: 'type', error: null }));
    const jobs = images.map((path) => ({
      name: fileName(path),
      add: (into: string | null) => chatBridge.mediaAttach(conversationId, [path], into),
    }));
    const skipped = await runJobs(conversationId, jobs, max);
    useChatMediaStore.getState().setSkipped(conversationId, [...wrong, ...skipped]);
  });
}

export function attachData(
  conversationId: ConvId,
  files: { name: string; bytes: Uint8Array }[],
  max: number,
): Promise<void> {
  return queued(conversationId, async () => {
    const jobs = files.map((file) => ({
      name: file.name,
      add: (into: string | null) => chatBridge.mediaAttachData(conversationId, file.bytes, into),
    }));
    const skipped = await runJobs(conversationId, jobs, max);
    useChatMediaStore.getState().setSkipped(conversationId, skipped);
  });
}
