import type { UploadView } from '../../../../lib/chat/media-types';

const PART = 32 * 1024;

export function isDone(upload: UploadView): boolean {
  return upload.state === 'uploaded' || upload.state === 'committed';
}

export function uploadFraction(upload: UploadView): number {
  if (isDone(upload)) return 1;
  const total = upload.imageBytes + upload.thumbBytes + upload.motionBytes;
  if (total <= 0 || upload.state === 'queued' || upload.state === 'reserved') return 0;
  const sent = upload.partsSent * PART;
  const done =
    upload.object === 'image'
      ? Math.min(sent, upload.imageBytes)
      : upload.object === 'thumb'
        ? upload.imageBytes + Math.min(sent, upload.thumbBytes)
        : upload.imageBytes + upload.thumbBytes + Math.min(sent, upload.motionBytes);
  return Math.min(0.99, done / total);
}

export function albumFraction(uploads: UploadView[]): number {
  if (uploads.length === 0) return 0;
  return uploads.reduce((sum, upload) => sum + uploadFraction(upload), 0) / uploads.length;
}
