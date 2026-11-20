import React from 'react';
import type {Aura} from '../../lib/aura';
import {pauseBlack22, playBlack22} from '../../lib/icons';
import {useVideoOpaque} from '../../lib/video-element';
import {AlbumCoverArtifact} from '../album/AlbumCoverArtifact';
import {RoomVideo} from './RoomVideo';

/** The room's light source: the cover artifact (genre-ring when verified)
 *  with a play/pause affordance. Click toggles playback. */
export const TrackCover = React.memo(function TrackCover({
                                                             title,
                                                             coverUrl,
                                                             aura,
                                                             verified,
                                                             isPlaying,
                                                             isCurrent,
                                                             onToggle,
                                                         }: {
    title: string;
    coverUrl?: string;
    aura: Aura;
    verified: boolean;
    isPlaying: boolean;
    isCurrent: boolean;
    onToggle: () => void;
}) {
    const live = useVideoOpaque() === 'room';
    const held = isPlaying && !live;
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={title}
            data-ui="artwork"
            className="relative shrink-0 self-center @min-[740px]:self-start group/cover cursor-pointer"
        >
            <AlbumCoverArtifact
                title={title}
                coverUrl={coverUrl}
                hasStar={verified}
                aura={aura}
                spinning={isPlaying}
            >
                <RoomVideo on={isCurrent}/>
            </AlbumCoverArtifact>
            <div
                className={`absolute inset-0 rounded-[2.2rem] flex items-center justify-center transition-all duration-300 pointer-events-none ${
                    held
                        ? 'bg-black/25 opacity-100'
                        : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
                }`}
            >
        <span
            className={`w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-2xl transition-transform duration-300 ease-[var(--ease-apple)] ${
                held ? 'scale-100' : 'scale-75 group-hover/cover:scale-100'
            }`}
        >
          {isPlaying ? pauseBlack22 : playBlack22}
        </span>
            </div>
        </button>
    );
});
