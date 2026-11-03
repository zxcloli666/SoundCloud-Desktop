import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {durLong} from '../../lib/formatters';
import type {Playlist} from '../../lib/hooks';
import {Calendar, Clock, Hash, ListMusic, Users} from '../../lib/icons';
import type {Track} from '../../stores/player';

function Fact({
                  icon,
                  text,
                  accentGlow,
              }: {
    icon: React.ReactNode;
    text: string;
    accentGlow: string;
}) {
    return (
        <div
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-[12px] font-semibold text-ink-70"
            style={{
                background: 'rgb(var(--ink) / 0.035)',
                border: '0.5px solid rgb(var(--ink) / 0.07)',
                boxShadow: `0 8px 22px ${accentGlow}`,
            }}
        >
            <span className="text-ink-40">{icon}</span>
            <span className="tabular-nums">{text}</span>
        </div>
    );
}

/** The crate ledger — facts only a curated collection has: distinct artists,
 *  genres spanned, the year range it digs across. */
export const CrateLedger = React.memo(function CrateLedger({
                                                               playlist,
                                                               tracks,
                                                               accentGlow,
                                                           }: {
    playlist: Playlist;
    tracks: Track[];
    accentGlow: string;
}) {
    const {t} = useTranslation();

    const sig = `${tracks.length}:${tracks[0]?.urn ?? ''}`;
    // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on cheap signature
    const stats = useMemo(() => {
        const artists = new Set<string>();
        const genres = new Set<string>();
        let minYear = Infinity;
        let maxYear = -Infinity;
        for (const tr of tracks) {
            if (tr.user?.urn) artists.add(tr.user.urn);
            const g = tr.genre?.trim();
            if (g) genres.add(g.toLowerCase());
            const y = tr.release_year;
            if (y && y > 1900) {
                if (y < minYear) minYear = y;
                if (y > maxYear) maxYear = y;
            }
        }
        return {
            artists: artists.size,
            genres: genres.size,
            yearFrom: minYear === Infinity ? null : minYear,
            yearTo: maxYear === -Infinity ? null : maxYear,
        };
    }, [sig]);

    const count = playlist.track_count || tracks.length;

    return (
        <div className="flex flex-wrap items-center gap-2.5">
            <Fact
                icon={<ListMusic size={13}/>}
                text={t('playlist.tracks', {count})}
                accentGlow={accentGlow}
            />
            {playlist.duration > 0 && (
                <Fact
                    icon={<Clock size={13}/>}
                    text={durLong(playlist.duration)}
                    accentGlow={accentGlow}
                />
            )}
            {stats.artists > 1 && (
                <Fact
                    icon={<Users size={13}/>}
                    text={t('playlist.distinctArtists', {count: stats.artists})}
                    accentGlow={accentGlow}
                />
            )}
            {stats.genres > 1 && (
                <Fact
                    icon={<Hash size={13}/>}
                    text={t('playlist.spansGenres', {count: stats.genres})}
                    accentGlow={accentGlow}
                />
            )}
            {stats.yearFrom != null && stats.yearTo != null && (
                <Fact
                    icon={<Calendar size={13}/>}
                    text={
                        stats.yearFrom === stats.yearTo
                            ? String(stats.yearFrom)
                            : t('playlist.yearRange', {from: stats.yearFrom, to: stats.yearTo})
                    }
                    accentGlow={accentGlow}
                />
            )}
        </div>
    );
});
