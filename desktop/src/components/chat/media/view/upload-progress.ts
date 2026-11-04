import type { UploadView } from '../../../../lib/chat/media-types';

const PART_BYTES = 32 * 1024;

export function uploadDone(upload: UploadView): boolean {
  return upload.state === 'uploaded' || upload.state === 'committed';
}

export function uploadFraction(upload: UploadView): number {
  if (uploadDone(upload)) return 1;
  const total = upload.thumbBytes + upload.imageBytes;
  if (total <= 0) return 0;
  const sent = upload.partsSent * PART_BYTES;
  const bytes =
    upload.object === 'thumb'
      ? Math.min(sent, upload.thumbBytes)
      : upload.thumbBytes + Math.min(sent, upload.imageBytes);
  return Math.min(0.99, bytes / total);
}

export interface AlbumProgress {
  total: number;
  done: number;
  failed: number;
  fraction: number;
}

export function albumProgress(uploads: UploadView[]): AlbumProgress {
  let done = 0;
  let failed = 0;
  let bytes = 0;
  let sent = 0;
  for (const upload of uploads) {
    const size = Math.max(1, upload.thumbBytes + upload.imageBytes);
    if (uploadDone(upload)) done++;
    if (upload.state === 'failed') failed++;
    bytes += size;
    sent += size * uploadFraction(upload);
  }
  return { total: uploads.length, done, failed, fraction: bytes > 0 ? sent / bytes : 0 };
}
