import React from 'react'
import type { FeedItem } from '../../lib/hooks.ts'
import type { Track } from '../../stores/player.ts'
import { useNavigate } from 'react-router-dom'
import {
    replaceArtSize,
    toCompactCount,
    toMinSec,
    toRelativeTime,
} from '../../lib/utils.ts'
import { preloadTrack } from '../../lib/audio.ts'
import { Headphones, Heart, Music, Pause, Play, Repeat2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTrackPlayback } from '../../lib/hooks/useTrackPlayback.ts'

export const FeedTrackCardBase = ({
    item,
    queue,
}: {
    item: FeedItem
    queue: Track[]
}) => {
    const { t } = useTranslation()

    const navigate = useNavigate()
    const track = item.origin as Track
    const isRepost = item.type.includes('repost')
    const cover = replaceArtSize(track.artwork_url, 't300x300')

    const { isCurrent, isCurrentPlaying, togglePlay } = useTrackPlayback(
        track,
        queue
    )

    return (
        <div
            className={`group glass rounded-2xl p-3 flex items-center gap-3.5 transition-all duration-300 ease-[var(--ease-apple)] ${
                isCurrent
                    ? 'ring-1 ring-accent/20 bg-accent/[0.02]'
                    : 'hover:bg-white/[0.035]'
            }`}
            onMouseEnter={() => preloadTrack(track.urn)}
        >
            {/* Artwork */}
            <div
                className="relative w-[76px] h-[76px] rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.06] cursor-pointer"
                onClick={togglePlay}
            >
                {cover ? (
                    <img
                        src={cover}
                        alt={track.title}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                        <Music size={22} className="text-white/15" />
                    </div>
                )}

                {/* Play overlay */}
                <div
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
                        isCurrentPlaying
                            ? 'bg-black/30 opacity-100'
                            : 'bg-black/0 opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
                    }`}
                >
                    <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ease-[var(--ease-apple)] ${
                            isCurrentPlaying
                                ? 'bg-white scale-100'
                                : 'bg-white/90 scale-75 group-hover:scale-100'
                        }`}
                    >
                        {isCurrentPlaying ? (
                            <Pause size={14} fill="black" strokeWidth={0} />
                        ) : (
                            <Play
                                size={14}
                                fill="black"
                                strokeWidth={0}
                                className="ml-px"
                            />
                        )}
                    </div>
                </div>
            </div>

            {/* Track info */}
            <div className="flex-1 min-w-0">
                {isRepost && (
                    <div className="flex items-center gap-1 mb-1 text-[10px] text-white/20 font-medium">
                        <Repeat2 size={9} />
                        <span>{t('home.reposted')}</span>
                    </div>
                )}
                <p
                    className="text-[13px] font-medium text-white/90 truncate leading-snug cursor-pointer hover:text-white transition-colors duration-150"
                    onClick={() =>
                        navigate(`/track/${encodeURIComponent(track.urn)}`)
                    }
                >
                    {track.title}
                </p>
                <p
                    className="text-[11px] text-white/35 truncate mt-0.5 cursor-pointer hover:text-white/55 transition-colors duration-150"
                    onClick={() =>
                        navigate(`/user/${encodeURIComponent(track.user.urn)}`)
                    }
                >
                    {track.user.username}
                </p>
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-white/20 tabular-nums">
                    {track.genre && (
                        <span className="px-1.5 py-px rounded-full bg-white/[0.04] text-white/30 border border-white/[0.04] text-[9px]">
                            {track.genre}
                        </span>
                    )}
                    <span className="flex items-center gap-0.5">
                        <Headphones size={9} />
                        {toCompactCount(track.playback_count)}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <Heart size={9} />
                        {toCompactCount(
                            track.favoritings_count ?? track.likes_count
                        )}
                    </span>
                </div>
            </div>

            {/* Duration + time */}
            <div className="text-right shrink-0 self-center">
                <p className="text-[11px] text-white/30 tabular-nums font-medium">
                    {toMinSec(track.duration)}
                </p>
                <p className="text-[10px] text-white/15 mt-0.5">
                    {toRelativeTime(item.created_at)}
                </p>
            </div>
        </div>
    )
}

export const FeedTrackCard = React.memo(FeedTrackCardBase)
