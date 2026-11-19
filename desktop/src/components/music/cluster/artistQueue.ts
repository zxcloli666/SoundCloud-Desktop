import { api } from '../../../lib/api';
import type { Track } from '../../../stores/player';

export async function fetchArtistQueue(artistId: string, first: Track): Promise<Track[]> {
  try {
    const res = await api<{ collection: Track[] }>(
      `/artists/${encodeURIComponent(artistId)}/tracks?role=primary&sort=popular&limit=60`,
    );
    const rest = (res.collection ?? []).filter((t) => t.urn !== first.urn);
    return [first, ...rest];
  } catch {
    return [first];
  }
}
