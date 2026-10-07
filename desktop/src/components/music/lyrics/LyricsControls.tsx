import {useQueryClient} from '@tanstack/react-query';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {useShallow} from 'zustand/shallow';
import {api} from '../../../lib/api';
import {handlePrev} from '../../../lib/audio';
import {toggleDislike, useDislikeStatus} from '../../../lib/dislikes';
import {invalidateAllLikesCache} from '../../../lib/hooks';
import {
    ExternalLink,
    Heart,
    ListPlus,
    pauseBlack18,
    playBlack18,
    repeat1Icon16,
    repeatIcon16,
    SkipBack,
    SkipForward,
    shuffleIcon16,
    ThumbsDown,
} from '../../../lib/icons';
import {optimisticToggleLike, useLiked} from '../../../lib/likes';
import {useLyricsStore} from '../../../stores/lyrics';
import {type Track, usePlayerStore} from '../../../stores/player';
import {AddToPlaylistDialog} from '../AddToPlaylistDialog';

const FullscreenLikeButton = React.memo(({track}: { track: Track }) => {
    const liked = useLiked(track.urn);
    const qc = useQueryClient();

    const toggle = async () => {
        const next = !liked;
        optimisticToggleLike(qc, track, next);
        invalidateAllLikesCache();
        try {
            await api(`/likes/tracks/${encodeURIComponent(track.urn)}`, {
                method: next ? 'POST' : 'DELETE',
            });
        } catch {
            optimisticToggleLike(qc, track, !next);
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-white/[0.06] outline-none ${
                liked ? 'text-accent' : 'text-white/30 hover:text-white/60'
            }`}
        >
            <Heart size={20} fill={liked ? 'currentColor' : 'none'}/>
        </button>
    );
});

const FullscreenDislikeButton = React.memo(({track}: { track: Track }) => {
    const {t} = useTranslation();
    const qc = useQueryClient();
    const disliked = useDislikeStatus(track.urn);
    const next = usePlayerStore((s) => s.next);

    const toggle = async () => {
        const nowDisliked = !disliked;
        if (nowDisliked && track.user_favorite) {
            optimisticToggleLike(qc, track, false);
            invalidateAllLikesCache();
            api(`/likes/tracks/${encodeURIComponent(track.urn)}`, {method: 'DELETE'}).catch(() => {
            });
        }
        if (nowDisliked && usePlayerStore.getState().currentTrack?.urn === track.urn) {
            next();
        }
        await toggleDislike(qc, track, nowDisliked);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={disliked ? t('track.removeDislike') : t('track.dislike')}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-white/[0.06] outline-none ${
                disliked ? 'text-rose-400' : 'text-white/30 hover:text-white/60'
            }`}
        >
            <ThumbsDown size={18} fill={disliked ? 'currentColor' : 'none'}/>
        </button>
    );
});

const FullscreenOpenTrackButton = React.memo(({track}: { track: Track }) => {
    const {t} = useTranslation();
    const navigate = useNavigate();
    const closeLyrics = useLyricsStore((s) => s.close);
    return (
        <button
            type="button"
            onClick={() => {
                closeLyrics();
                navigate(`/track/${encodeURIComponent(track.urn)}`);
            }}
            title={t('track.openTrackPage')}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-white/[0.06] text-white/30 hover:text-white/60 outline-none"
        >
            <ExternalLink size={18}/>
        </button>
    );
});

export const Controls = React.memo(({track}: { track: Track }) => {
    const {isPlaying, next, repeat, shuffle, togglePlay, toggleRepeat, toggleShuffle} =
        usePlayerStore(
            useShallow((s) => ({
                isPlaying: s.isPlaying,
                next: s.next,
                repeat: s.repeat,
                shuffle: s.shuffle,
                togglePlay: s.togglePlay,
                toggleRepeat: s.toggleRepeat,
                toggleShuffle: s.toggleShuffle,
            })),
        );

    const ctrl =
        'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-white/[0.06] outline-none';
    const small =
        'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-white/[0.06] outline-none';

    return (
        <div className="flex items-center justify-center gap-2">
            <AddToPlaylistDialog trackUrns={[track.urn]}>
                <button type="button" className={`${small} text-white/30 hover:text-white/60`}>
                    <ListPlus size={20}/>
                </button>
            </AddToPlaylistDialog>
            <FullscreenLikeButton track={track}/>
            <button
                type="button"
                onClick={toggleShuffle}
                className={`${small} ${shuffle ? 'text-accent' : 'text-white/35 hover:text-white/60'}`}
            >
                {shuffleIcon16}
            </button>
            <button
                type="button"
                onClick={handlePrev}
                className={`${ctrl} text-white/60 hover:text-white`}
            >
                <SkipBack size={20} fill="currentColor"/>
            </button>
            <button
                type="button"
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer shadow-lg outline-none"
            >
                {isPlaying ? pauseBlack18 : playBlack18}
            </button>
            <button type="button" onClick={next} className={`${ctrl} text-white/60 hover:text-white`}>
                <SkipForward size={20} fill="currentColor"/>
            </button>
            <button
                type="button"
                onClick={toggleRepeat}
                className={`${small} ${repeat !== 'off' ? 'text-accent' : 'text-white/35 hover:text-white/60'}`}
            >
                {repeat === 'one' ? repeat1Icon16 : repeatIcon16}
            </button>
            <FullscreenDislikeButton track={track}/>
            <FullscreenOpenTrackButton track={track}/>
        </div>
    );
});
