import type { UploadView } from '../../../lib/chat/media-types';

export const BACKDROP_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

const PART_BYTES = 32 * 1024;

export async function pickBackdropPath(title: string): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: title, extensions: BACKDROP_EXTENSIONS }],
  });
  return typeof picked === 'string' ? picked : null;
}

export function uploadPercent(upload: UploadView | null): number {
  if (!upload) return 0;
  if (upload.state === 'uploaded' || upload.state === 'committed') return 100;
  if (upload.state !== 'uploading' || upload.imageBytes <= 0) return 0;
  return Math.min(99, Math.round(((upload.partsSent * PART_BYTES) / upload.imageBytes) * 100));
}
