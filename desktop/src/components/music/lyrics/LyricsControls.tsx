import {useQueryClient} from '@tanstack/react-query';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {useShallow} from 'zustand/shallow';
import {api} from '../../../lib/api';
import {handlePrev} from '../../../lib/audio';
import {forgetOfflineLike} from '../../../lib/cache';
import {clearDislike, dislikeTrack} from '../../../lib/dislike-actions';
import {useDislikeStatus} from '../../../lib/dislikes';
import {trackTasteWrite} from '../../../lib/events';
import {invalidateAllLikesCache} from '../../../lib/hooks';
import {
    ExternalLink,
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
import {isLocalUrn} from '../../../lib/local-library';
import {rememberLikedUrn} from '../../../lib/offline-index';
import {useSuperliked} from '../../../lib/superlikes';
import {useLyricsStore} from '../../../stores/lyrics';
import {type Track, usePlayerStore} from '../../../stores/player';
import {AddToPlaylistDialog} from '../AddToPlaylistDialog';
import {HoldHeart} from '../superlike/HoldHeart';
import {heartTitle} from '../superlike/heart-title';
import {useSuperlikeGesture} from '../superlike/useSuperlikeGesture';

const FullscreenLikeButton = React.memo(({track}: { track: Track }) => {
    const {t} = useTranslation();
    const liked = useLiked(track.urn);
    const superliked = useSuperliked(track.urn, track.user_superlike) && liked;
    const qc = useQueryClient();

    const toggle = async () => {
        const next = !liked;
        optimisticToggleLike(qc, track, next);
        invalidateAllLikesCache();
        if (next) clearDislike(track.urn);
        try {
            await trackTasteWrite(
                api(`/likes/tracks/${encodeURIComponent(track.urn)}`, {
                    method: next ? 'POST' : 'DELETE',
                }),
            );
            void (next ? rememberLikedUrn(track.urn, track) : forgetOfflineLike(track.urn));
        } catch {
            optimisticToggleLike(qc, track, !next);
        }
    };

    const gesture = useSuperlikeGesture(track, () => void toggle());

    return (
        <button
            type="button"
            {...gesture.handlers}
            title={heartTitle(t, liked, superliked)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-ink/[0.06] outline-none ${
                liked ? 'text-accent' : 'text-ink-30 hover:text-ink-60'
            }`}
        >
            <HoldHeart liked={liked} superliked={superliked} size={20} gesture={gesture}/>
        </button>
    );
});

const FullscreenDislikeButton = React.memo(({track}: { track: Track }) => {
    const {t} = useTranslation();
    const disliked = useDislikeStatus(track.urn);

    const toggle = () => {
        if (disliked) clearDislike(track.urn);
        else void dislikeTrack(track);
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={disliked ? t('track.removeDislike') : t('track.dislike')}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer hover:bg-ink/[0.06] outline-none ${
                disliked ? 'text-rose-400' : 'text-ink-30 hover:text-ink-60'
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
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-ink/[0.06] text-ink-30 hover:text-ink-60 outline-none"
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
        'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-ink/[0.06] outline-none';
    const small =
        'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer hover:bg-ink/[0.06] outline-none';
    const remote = !isLocalUrn(track.urn);

    return (
        <div className="flex items-center justify-center gap-2">
            {remote && (
                <>
                    <AddToPlaylistDialog trackUrns={[track.urn]}>
                        <button type="button" className={`${small} text-ink-30 hover:text-ink-60`}>
                            <ListPlus size={20}/>
                        </button>
                    </AddToPlaylistDialog>
                    <FullscreenLikeButton track={track}/>
                </>
            )}
            <button
                type="button"
                onClick={toggleShuffle}
                className={`${small} ${shuffle ? 'text-accent' : 'text-ink-35 hover:text-ink-60'}`}
            >
                {shuffleIcon16}
            </button>
            <button
                type="button"
                onClick={handlePrev}
                className={`${ctrl} text-ink-60 hover:text-ink`}
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
            <button type="button" onClick={next} className={`${ctrl} text-ink-60 hover:text-ink`}>
                <SkipForward size={20} fill="currentColor"/>
            </button>
            <button
                type="button"
                onClick={toggleRepeat}
                className={`${small} ${repeat !== 'off' ? 'text-accent' : 'text-ink-35 hover:text-ink-60'}`}
            >
                {repeat === 'one' ? repeat1Icon16 : repeatIcon16}
            </button>
            {remote && (
                <>
                    <FullscreenDislikeButton track={track}/>
                    <FullscreenOpenTrackButton track={track}/>
                </>
            )}
        </div>
    );
});
