import { isWindows } from '../platform';
import type { MediaId, MediaVariant } from './media-types';
import type { ConvId } from './types';

type LabMedia = (conversationId: ConvId, mediaId: MediaId, variant: string) => string | null;

export function hideOnError(event: { currentTarget: HTMLImageElement }) {
  event.currentTarget.style.display = 'none';
}

export function chatMediaUrl(conversationId: ConvId, mediaId: MediaId, variant: MediaVariant) {
  if (import.meta.env.DEV) {
    const lab = (window as { __chatLabMedia?: LabMedia }).__chatLabMedia;
    const url = lab?.(conversationId, mediaId, variant);
    if (url) return url;
  }
  const base = isWindows() ? 'http://chatmedia.localhost' : 'chatmedia://localhost';
  return `${base}/${conversationId}/${mediaId}/${variant}`;
}
