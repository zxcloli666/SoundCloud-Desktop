import type {HistoryEntry} from '../../lib/hooks';
import type {Track} from '../../stores/player';

export function formatHistoryDate(dateStr: string, t: (k: string) => string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    if (d >= today) return t('library.today');
    if (d >= yesterday) return t('library.yesterday');
    return t('library.earlier');
}

export function historyEntryToTrack(entry: HistoryEntry): Track {
    return {
        id: 0,
        urn: entry.trackUrn,
        title: entry.title,
        duration: entry.duration,
        artwork_url: entry.artworkUrl,
        user: {
            id: 0,
            urn: entry.artistUrn || '',
            username: entry.artistName,
            avatar_url: '',
            permalink_url: '',
        },
    };
}
