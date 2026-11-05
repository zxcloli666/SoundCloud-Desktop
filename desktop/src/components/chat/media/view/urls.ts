import type { MediaId, MediaVariant } from '../../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../../lib/chat/media-url';
import type { ConvId } from '../../../../lib/chat/types';

export type ViewVariant = 'placeholder' | 'thumb' | 'image' | 'upload-thumb';

export function viewUrl(
  conversationId: ConvId,
  mediaId: MediaId,
  variant: ViewVariant,
  attempt = 0,
): string {
  const url = chatMediaUrl(conversationId, mediaId, variant as MediaVariant);
  return attempt > 0 && !url.startsWith('data:') ? `${url}?retry=${attempt}` : url;
}

export function warmUrl(url: string) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
}
