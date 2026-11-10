import type { UploadView } from '../../../lib/chat/media-types';
import type { ChatError } from '../../../lib/chat/types';
import type { BackdropProblem } from './errors';
import type { PhotoState } from './PhotoTile';

export type UploadStatus =
  | { kind: 'active'; upload: UploadView | null }
  | { kind: 'failed' }
  | null;

export interface ImageGate {
  disabled: boolean;
  acts: boolean;
}

export function uploadStatus(
  upload: UploadView | null,
  error: ChatError | null,
  fetching = false,
): UploadStatus {
  if (fetching) return { kind: 'active', upload: null };
  if (upload && upload.state !== 'failed' && upload.state !== 'committed') {
    return { kind: 'active', upload };
  }
  if (upload?.state === 'failed' || error) return { kind: 'failed' };
  return null;
}

export function photoWaitUntil(
  roomUntil: number | null | undefined,
  problem: BackdropProblem | null,
): number | null {
  const refusedUntil = problem?.fix === 'wait' ? problem.until : null;
  return Math.max(roomUntil ?? 0, refusedUntil ?? 0) || null;
}

export function photoState(
  status: UploadStatus,
  imageSrc: string | null,
  cooldownMs: number,
): PhotoState {
  if (status?.kind === 'active') return { kind: 'uploading', upload: status.upload };
  if (cooldownMs > 0) return { kind: 'cooldown', leftMs: cooldownMs };
  if (status?.kind === 'failed') return { kind: 'failed' };
  if (imageSrc) return { kind: 'current', src: imageSrc };
  return { kind: 'idle' };
}

export function imageGate(photo: PhotoState, waiting: boolean, ready: boolean): ImageGate {
  const busy = photo.kind === 'uploading' || photo.kind === 'cooldown';
  return { disabled: waiting || busy, acts: ready && !busy };
}
