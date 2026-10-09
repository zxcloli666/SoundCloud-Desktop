import type {CacheInventoryEntry} from '../../lib/cache';
import type {OfflineCollection} from '../../lib/offline-index';
import type {Track} from '../../stores/player';

export type OfflineSection = 'likes' | 'cached' | 'playlists' | 'local';

export type SortMode = 'custom' | 'recent' | 'title' | 'artist' | 'duration' | 'size';

/** Строка офлайн-библиотеки: метаданные трека + факты о файле на диске.
 *  `inv === null` — лайк без файла; `stub` — файл без записи в офлайн-индексе. */
export interface OfflineEntry {
  urn: string;
  track: Track;
  inv: CacheInventoryEntry | null;
  stub?: boolean;
}

export interface CollectionView extends OfflineCollection {
  total: number;
  savedCount: number;
  bytes: number;
}
