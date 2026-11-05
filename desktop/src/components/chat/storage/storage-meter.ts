import type { MediaConfig, MediaUsage } from '../../../lib/chat/media-types';
import { quotaFull } from './ring-tone.ts';

export interface StorageMeter {
  used: number;
  quota: number;
  full: boolean;
  files: number | null;
}

export function storageMeter(
  media: Pick<MediaConfig, 'used' | 'quota'> | null,
  usage: MediaUsage | null,
): StorageMeter | null {
  if (!media) return null;
  const used = usage ? usage.bytes + usage.reserved : media.used;
  const quota = usage?.quota ?? media.quota;
  return { used, quota, full: quotaFull(used, quota), files: usage?.files ?? null };
}
