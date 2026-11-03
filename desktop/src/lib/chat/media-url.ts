import { isWindows } from '../platform';
import type { MediaId, MediaVariant } from './media-types';
import type { ConvId } from './types';

export function chatMediaUrl(conversationId: ConvId, mediaId: MediaId, variant: MediaVariant) {
  const base = isWindows() ? 'http://chatmedia.localhost' : 'chatmedia://localhost';
  return `${base}/${conversationId}/${mediaId}/${variant}`;
}
