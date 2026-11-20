import { ApiError, api } from './api';
import { type CoverFrame, type CoverSize, outputSide } from './cover-crop';

export const COVER_TYPES = 'image/jpeg,image/png,image/webp';
const QUALITY = 0.9;
const UPLOAD_TIMEOUT_MS = 60_000;
const QUIET = [400, 404, 413, 415, 422, 503];

const ERROR_KEYS: Record<string, string> = {
  artwork_too_small: 'playlist.cover.tooSmall',
  artwork_too_large: 'playlist.cover.tooLarge',
  artwork_unsupported: 'playlist.cover.unsupported',
  artwork_invalid: 'playlist.cover.unreadable',
};

export function coverErrorKey(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && ERROR_KEYS[error.code]) return ERROR_KEYS[error.code];
    if (error.status === 413) return 'playlist.cover.tooLarge';
  }
  return 'playlist.cover.notSaved';
}

export type CoverSource = { url: string; image: HTMLImageElement; size: CoverSize };

export async function loadCover(file: Blob): Promise<CoverSource> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { url, image, size: { width: image.naturalWidth, height: image.naturalHeight } };
}

export function renderCover(image: HTMLImageElement, frame: CoverFrame): Promise<Blob> {
  const side = outputSide(frame);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext('2d');
  if (!context) return Promise.reject(new Error('canvas is unavailable'));
  context.fillStyle = '#fff';
  context.fillRect(0, 0, side, side);
  context.imageSmoothingQuality = 'high';
  const half = frame.side / 2;
  context.drawImage(
    image,
    frame.x - half,
    frame.y - half,
    frame.side,
    frame.side,
    0,
    0,
    side,
    side,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('cover was not encoded'))),
      'image/jpeg',
      QUALITY,
    ),
  );
}

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function uploadCover(playlistUrn: string, jpeg: Blob): Promise<void> {
  await api(
    `/playlists/${encodeURIComponent(playlistUrn)}/artwork`,
    {
      method: 'PUT',
      body: JSON.stringify({ image_data: await base64(jpeg) }),
      silentStatuses: QUIET,
    },
    UPLOAD_TIMEOUT_MS,
  );
}
