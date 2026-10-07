import {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {useHistory} from '../../lib/hooks';
import {ChevronRight, Clock} from '../../lib/icons';
import {TrackCard} from '../music/TrackCard';
import {HorizontalScroll} from '../ui/HorizontalScroll';
import {historyEntryToTrack} from './history-utils';

/** "Jump back in" — the last things you played, deduped, so resuming your world
 *  is one click from the hub. */
export const ContinueRow = memo(function ContinueRow({genre}: { genre?: string | null }) {
    const {t} = useTranslation();
    const {entries} = useHistory();

    const tracks = useMemo(() => {
        const seen = new Set<string>();
        const out = [];
        for (const e of entries) {
            if (seen.has(e.trackUrn)) continue;
            seen.add(e.trackUrn);
            out.push(historyEntryToTrack(e));
            if (out.length >= 14) break;
        }
        return out;
    }, [entries]);

    // History carries no genre, so it can't be genre-scoped — step aside in genre mode.
    if (genre || tracks.length === 0) return null;

    return (
        <section>
            <div className="flex items-center gap-2.5 mb-3 px-1">
        <span className="text-white/55">
          <Clock size={16}/>
        </span>
                <h2 className="text-[16px] font-bold tracking-tight text-white/90">
                    {t('library.continue')}
                </h2>
                <Link
                    to="/library/history"
                    className="ml-auto flex items-center gap-0.5 text-[12px] font-semibold text-white/45 hover:text-white/90 transition-colors"
                >
                    {t('library.seeAll')}
                    <ChevronRight size={14}/>
                </Link>
            </div>
            <HorizontalScroll>
                {tracks.map((tr) => (
                    <div key={tr.urn} className="w-[150px] shrink-0">
                        <TrackCard track={tr} queue={tracks}/>
                    </div>
                ))}
            </HorizontalScroll>
        </section>
    );
});
