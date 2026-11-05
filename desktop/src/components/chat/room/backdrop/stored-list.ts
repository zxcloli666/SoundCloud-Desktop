import type { MediaId, MediaRef, MyMedia } from '../../../../lib/chat/media-types';
import type { ShownMedia } from '../../../../stores/chat/media';

export interface StoredFilter {
  known: ReadonlySet<MediaId>;
  gone: Readonly<Record<MediaId, ShownMedia>>;
  current: MediaId | null;
}

const GONE: ReadonlySet<ShownMedia | undefined> = new Set(['deleted', 'lost']);

export function worthAsking(item: MyMedia): boolean {
  return item.kind !== 'avatar' && (item.status === 'uploaded' || item.status === 'attached');
}

export function refOf(item: MyMedia): MediaRef {
  return { conversationId: item.conversation_id, mediaId: item.id };
}

export function storedChoices(items: MyMedia[], filter: StoredFilter): MyMedia[] {
  return items.filter(
    (item) =>
      worthAsking(item) &&
      filter.known.has(item.id) &&
      item.id !== filter.current &&
      !GONE.has(filter.gone[item.id]),
  );
}
