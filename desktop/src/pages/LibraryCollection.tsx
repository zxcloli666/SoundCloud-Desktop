import React, {useDeferredValue, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Navigate, useParams} from 'react-router-dom';
import {FollowingTab} from '../components/library/FollowingTab';
import {HistoryTab} from '../components/library/HistoryTab';
import {LibraryFrame} from '../components/library/LibraryFrame';
import {LibrarySubHeader} from '../components/library/LibrarySubHeader';
import {LikesTab} from '../components/library/LikesTab';
import {PlaylistsTab} from '../components/library/PlaylistsTab';
import {StatsView} from '../components/library/stats/StatsView';
import {useSoundprint} from '../components/library/useSoundprint';
import {useLikedTracks} from '../lib/hooks';
import {likedTracksCount} from '../lib/likes';
import {useAuthStore} from '../stores/auth';

type Section = 'likes' | 'playlists' | 'following' | 'history' | 'stats';
const SECTIONS: Section[] = ['likes', 'playlists', 'following', 'history', 'stats'];

const TITLE_KEY: Record<Section, string> = {
    likes: 'library.likedTracks',
    playlists: 'search.playlists',
    following: 'nav.following',
    history: 'library.history',
    stats: 'stats.title',
};

/** A deep collection page (/library/:section) — the full, filterable, virtualized
 *  view that the hub's rails link into. */
export const LibraryCollection = React.memo(() => {
    const {t} = useTranslation();
    const {section} = useParams<{ section: string }>();
    const user = useAuthStore((s) => s.user);
    const {tracks: likedTracks} = useLikedTracks();
    const sound = useSoundprint(likedTracks);
    const [filter, setFilter] = useState('');
    const deferredFilter = useDeferredValue(filter);

    if (!user) return null;
    if (!section || !SECTIONS.includes(section as Section)) {
        return <Navigate to="/library" replace/>;
    }
    const sec = section as Section;
    const filterable = sec !== 'history' && sec !== 'stats';

    const count =
        sec === 'likes'
            ? likedTracksCount(user)
            : sec === 'playlists'
                ? user.playlist_count
                : sec === 'following'
                    ? user.followings_count
                    : undefined;

    return (
        <LibraryFrame sound={sound}>
            <LibrarySubHeader
                title={t(TITLE_KEY[sec])}
                aura={sound.aura}
                count={count}
                filter={filterable ? filter : undefined}
                onFilter={filterable ? setFilter : undefined}
            />

            {sec === 'likes' && <LikesTab filter={deferredFilter}/>}
            {sec === 'playlists' && <PlaylistsTab filter={deferredFilter}/>}
            {sec === 'following' && <FollowingTab filter={deferredFilter}/>}
            {sec === 'history' && <HistoryTab/>}
            {sec === 'stats' && <StatsView aura={sound.aura} accentGlow={sound.accentGlow}/>}
        </LibraryFrame>
    );
});
