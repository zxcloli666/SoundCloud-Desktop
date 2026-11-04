import type { MyMedia } from '../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../lib/chat/media-url';

export function thumbUrl(item: MyMedia): string {
  return chatMediaUrl(item.conversation_id, item.id, item.kind === 'image' ? 'thumb' : 'image');
}
