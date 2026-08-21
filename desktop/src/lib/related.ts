import type { Track } from '../stores/player';
import { api, ApiError } from './api';
import type { PagedResponse } from './hooks';

type RelatedTracks = PagedResponse<Track>;

const emptyRelated = (page: number, limit: number): RelatedTracks => ({
  collection: [],
  page,
  page_size: limit,
  has_more: false,
});

/**
 * Похожие треки к seed-треку. 404 от бэка = «соседей пока нет», а не ошибка:
 * отдаём пустую страницу — без тоста и без throw. Прочие ошибки пробрасываем.
 */
export async function fetchRelatedTracks(
  urn: string,
  limit = 10,
  page = 0,
  signal?: AbortSignal,
): Promise<RelatedTracks> {
  try {
    return await api<RelatedTracks>(
      `/tracks/${encodeURIComponent(urn)}/related?limit=${limit}&page=${page}`,
      { silentStatuses: [404], signal },
    );
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof ApiError && (e.status === 404 || e.status === 403 || e.status === 502))
      return emptyRelated(page, limit);
    throw e;
  }
}
