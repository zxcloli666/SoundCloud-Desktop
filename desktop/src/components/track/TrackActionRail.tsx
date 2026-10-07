import React from 'react';
import {useTranslation} from 'react-i18next';
import {ListPlus, MicVocal} from '../../lib/icons';
import {useLyricsStore} from '../../stores/lyrics';
import type {Track} from '../../stores/player';
import {AddToPlaylistDialog} from '../music/AddToPlaylistDialog';
import {CopyIconAction, DownloadButton, IconAction, LikeBtn, PlayPill} from './actions';
import {OwnerTrackActions} from './OwnerTrackActions';

/** Hero transport + engagement + utility rail. Lives OUTSIDE the genre-scoped
 *  wave wrapper, so play/like keep the user's own accent. */
export const TrackActionRail = React.memo(function TrackActionRail({
                                                                       track,
                                                                       isPlaying,
                                                                       isOwner,
                                                                       onPlay,
                                                                   }: {
    track: Track;
    isPlaying: boolean;
    isOwner: boolean;
    onPlay: () => void;
}) {
    const {t} = useTranslation();
    const openLyrics = useLyricsStore((s) => s.openPanel);

    return (
        <div className="flex items-center gap-3 flex-wrap">
            <PlayPill isPlaying={isPlaying} onClick={onPlay}/>
            <LikeBtn trackUrn={track.urn} count={track.favoritings_count ?? track.likes_count}/>
            <div
                className="flex items-center gap-0.5 h-11 px-1.5 rounded-2xl"
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.07)',
                }}
            >
                <IconAction
                    icon={<MicVocal size={16}/>}
                    label={t('track.lyrics')}
                    onClick={() => openLyrics('lyrics')}
                />
                <span className="w-px h-5 bg-white/[0.08] mx-0.5" aria-hidden/>
                <AddToPlaylistDialog trackUrns={[track.urn]}>
                    <button
                        type="button"
                        title={t('playlist.addToPlaylist')}
                        aria-label={t('playlist.addToPlaylist')}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white/60 hover:text-white/95 hover:bg-white/[0.07] transition-all duration-200 cursor-pointer"
                    >
                        <ListPlus size={16}/>
                    </button>
                </AddToPlaylistDialog>
                <CopyIconAction url={track.permalink_url}/>
                <DownloadButton track={track}/>
                {isOwner && <OwnerTrackActions track={track}/>}
            </div>
        </div>
    );
});
