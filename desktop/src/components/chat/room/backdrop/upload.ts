import { chatBridge } from '../../../../lib/chat/bridge';
import type { MediaRef, UploadView } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';

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

export function uploadBackdrop(code: string, conversationId: ConvId, path: string) {
  return chatBridge.roomBackdropUpload(code, conversationId, path);
}

export function uploadStoredBackdrop(code: string, conversationId: ConvId, source: MediaRef) {
  return chatBridge.roomBackdropStored(code, conversationId, source.conversationId, source.mediaId);
}

export function uploadPercent(upload: UploadView | null): number {
  if (!upload) return 0;
  if (upload.state === 'uploaded' || upload.state === 'committed') return 100;
  if (upload.state !== 'uploading' || upload.imageBytes <= 0) return 0;
  return Math.min(99, Math.round(((upload.partsSent * PART_BYTES) / upload.imageBytes) * 100));
}
