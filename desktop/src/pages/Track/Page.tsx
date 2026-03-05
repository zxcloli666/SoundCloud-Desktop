import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    Play,
    Pause,
    Heart,
    Repeat2,
    Loader2,
    Music,
    Headphones,
    MessageCircle,
    ChevronDown,
    ChevronUp,
    Clock,
    Calendar,
    Hash,
} from 'lucide-react'
import { api } from '../../lib/api.ts'
import type { Track } from '../../stores/player.ts'
import {
    useTrackComments,
    useRelatedTracks,
    useTrackFavoriters,
    useInfiniteScroll,
} from '../../lib/hooks.ts'
import {
    dateFormatted,
    replaceArtSize,
    toCompactCount,
    toHourMinSec,
} from '../../lib/utils.ts'
import { TrackCommentForm } from './TrackCommentForm.tsx'
import { TrackCommentItem } from './TrackCommentItem.tsx'
import { TrackLikeButton } from './TrackLikeButton.tsx'
import { TrackRepostButton } from './TrackRepostButton.tsx'
import { TrackRelatedRow } from './TrackRelatedRow.tsx'
import { useTrackPlayback } from '../../lib/hooks/useTrackPlayback.ts'

function parseTags(tagList?: string): string[] {
    if (!tagList) return []
    const tags: string[] = []
    const re = /"([^"]+)"|(\S+)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(tagList))) {
        tags.push(m[1] || m[2])
    }
    return tags
}

/* ── Main: Track ─────────────────────────────────────── */

const TrackPageBase = () => {
    const { urn } = useParams<{ urn: string }>()
    const { t } = useTranslation()
    const navigate = useNavigate()

    const [descExpanded, setDescExpanded] = useState(false)

    const { data: track, isLoading } = useQuery({
        queryKey: ['track', urn],
        queryFn: () => api<Track>(`/tracks/${encodeURIComponent(urn!)}`),
        enabled: !!urn,
        refetchOnMount: 'always',
    })

    const {
        comments,
        fetchNextPage: fetchMoreComments,
        hasNextPage: hasMoreComments,
        isFetchingNextPage: fetchingMoreComments,
        isLoading: commentsLoading,
    } = useTrackComments(urn)

    const commentsSentinel = useInfiniteScroll(
        hasMoreComments,
        fetchingMoreComments,
        fetchMoreComments
    )

    const { data: relatedData, isLoading: relatedLoading } = useRelatedTracks(
        urn,
        10
    )
    const { data: favoritersData } = useTrackFavoriters(urn, 12)

    if (isLoading || !track) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 size={24} className="text-white/15 animate-spin" />
            </div>
        )
    }

    const cover = replaceArtSize(track.artwork_url, 't500x500')
    const tags = parseTags(track.tag_list)
    const relatedTracks = relatedData?.collection ?? []
    const favorites = favoritersData?.collection ?? []
    const desc = track.description?.trim()
    const descLong = desc && desc.length > 200

    const { isCurrentPlaying, togglePlay } = useTrackPlayback(track, [
        track,
        ...relatedTracks,
    ])

    return (
        <div className="p-6 pb-4 space-y-7 animate-fade-in-up">
            {/* ── Hero ─────────────────────────────────────── */}
            <section className="relative rounded-3xl overflow-hidden glass-featured">
                {/* Blurred bg */}
                {cover && (
                    <div className="absolute inset-0 pointer-events-none">
                        <img
                            src={cover}
                            alt=""
                            className="w-full h-full object-cover scale-[1.5] blur-[100px] opacity-25 saturate-150"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-[rgb(8,8,10)]/80 via-[rgb(8,8,10)]/60 to-[rgb(8,8,10)]/80" />
                    </div>
                )}

                <div className="relative flex items-center gap-7 p-7">
                    {/* Artwork */}
                    <div
                        className="relative w-[220px] h-[220px] rounded-2xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1] cursor-pointer group/cover"
                        onClick={togglePlay}
                    >
                        {cover ? (
                            <img
                                src={cover}
                                alt={track.title}
                                className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover/cover:scale-[1.04]"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                                <Music size={48} className="text-white/15" />
                            </div>
                        )}
                        <div
                            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                                isCurrentPlaying
                                    ? 'bg-black/30 opacity-100'
                                    : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
                            }`}
                        >
                            <div
                                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${
                                    isCurrentPlaying
                                        ? 'bg-white scale-100'
                                        : 'bg-white/90 scale-75 group-hover/cover:scale-100'
                                }`}
                            >
                                {isCurrentPlaying ? (
                                    <Pause
                                        size={22}
                                        fill="black"
                                        strokeWidth={0}
                                    />
                                ) : (
                                    <Play
                                        size={22}
                                        fill="black"
                                        strokeWidth={0}
                                        className="ml-0.5"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 py-2">
                        {track.genre && (
                            <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.06] mb-3 uppercase tracking-wider">
                                {track.genre}
                            </span>
                        )}
                        <h1 className="text-2xl font-bold text-white/95 leading-tight mb-2 line-clamp-2">
                            {track.title}
                        </h1>

                        {/* Artist */}
                        <div
                            className="flex items-center gap-2.5 mb-5 cursor-pointer group/artist"
                            onClick={() =>
                                navigate(
                                    `/user/${encodeURIComponent(track.user.urn)}`
                                )
                            }
                        >
                            {track.user.avatar_url && (
                                <img
                                    src={
                                        replaceArtSize(
                                            track.user.avatar_url,
                                            'small'
                                        ) ?? ''
                                    }
                                    alt=""
                                    className="w-6 h-6 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150"
                                />
                            )}
                            <span className="text-[14px] text-white/50 group-hover/artist:text-white/70 transition-colors">
                                {track.user.username}
                            </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Main play button */}
                            <button
                                type="button"
                                onClick={togglePlay}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer shadow-[0_0_20px_var(--color-accent-glow)] ${
                                    isCurrentPlaying
                                        ? 'bg-white text-black hover:bg-white/90'
                                        : 'bg-accent text-white hover:bg-accent-hover active:scale-[0.97]'
                                }`}
                            >
                                {isCurrentPlaying ? (
                                    <Pause
                                        size={16}
                                        fill="currentColor"
                                        strokeWidth={0}
                                    />
                                ) : (
                                    <Play
                                        size={16}
                                        fill="currentColor"
                                        strokeWidth={0}
                                    />
                                )}
                                {isCurrentPlaying ? 'Pause' : 'Play'}
                            </button>

                            <TrackLikeButton
                                trackUrn={track.urn}
                                initialLiked={track.user_favorite}
                                count={
                                    track.favoritings_count ?? track.likes_count
                                }
                            />
                            <TrackRepostButton
                                trackUrn={track.urn}
                                count={track.reposts_count}
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats bar ────────────────────────────────── */}
            <section className="flex items-center gap-5 px-1 flex-wrap">
                <div className="flex items-center gap-1.5 text-[12px] text-white/30">
                    <Headphones size={13} className="text-white/20" />
                    <span className="tabular-nums font-medium">
                        {toCompactCount(track.playback_count)}
                    </span>
                    <span className="text-white/15">{t('track.plays')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-white/30">
                    <Heart size={13} className="text-white/20" />
                    <span className="tabular-nums font-medium">
                        {toCompactCount(
                            track.favoritings_count ?? track.likes_count
                        )}
                    </span>
                    <span className="text-white/15">{t('track.likes')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-white/30">
                    <Repeat2 size={13} className="text-white/20" />
                    <span className="tabular-nums font-medium">
                        {toCompactCount(track.reposts_count)}
                    </span>
                    <span className="text-white/15">{t('track.reposts')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-white/30">
                    <MessageCircle size={13} className="text-white/20" />
                    <span className="tabular-nums font-medium">
                        {toCompactCount(track.comment_count)}
                    </span>
                    <span className="text-white/15">{t('track.comments')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-white/25 ml-auto">
                    <Clock size={12} />
                    <span className="tabular-nums">
                        {toHourMinSec(track.duration)}
                    </span>
                </div>
            </section>

            {/* ── Two-column layout ────────────────────────── */}
            <div className="grid grid-cols-[1fr_320px] gap-6">
                {/* Left column */}
                <div className="space-y-6 min-w-0">
                    {/* Description */}
                    {desc && (
                        <section className="glass rounded-2xl p-5">
                            <h3 className="text-[13px] font-semibold text-white/50 mb-3 flex items-center gap-2">
                                {t('track.description')}
                            </h3>
                            <div
                                className={`text-[13px] text-white/45 leading-relaxed whitespace-pre-wrap break-words ${
                                    !descExpanded && descLong
                                        ? 'max-h-[120px] overflow-hidden relative'
                                        : ''
                                }`}
                            >
                                {desc}
                                {!descExpanded && descLong && (
                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[rgb(18,18,20)] to-transparent" />
                                )}
                            </div>
                            {descLong && (
                                <button
                                    type="button"
                                    onClick={() =>
                                        setDescExpanded(!descExpanded)
                                    }
                                    className="flex items-center gap-1 mt-2 text-[11px] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                                >
                                    {descExpanded ? (
                                        <ChevronUp size={12} />
                                    ) : (
                                        <ChevronDown size={12} />
                                    )}
                                    {descExpanded ? 'Show less' : 'Show more'}
                                </button>
                            )}
                        </section>
                    )}

                    {/* Tags */}
                    {tags.length > 0 && (
                        <section className="flex items-center gap-2 flex-wrap px-1">
                            <Hash size={12} className="text-white/15" />
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/[0.04] text-white/35 border border-white/[0.04] hover:bg-white/[0.06] hover:text-white/50 transition-all duration-150 cursor-default"
                                >
                                    {tag}
                                </span>
                            ))}
                        </section>
                    )}

                    {/* Comments */}
                    <section className="space-y-4">
                        <h3 className="text-[13px] font-semibold text-white/50 flex items-center gap-2 px-1">
                            <MessageCircle size={14} />
                            {t('track.comments')}
                            {track.comment_count != null && (
                                <span className="text-white/20 font-normal tabular-nums">
                                    ({toCompactCount(track.comment_count)})
                                </span>
                            )}
                        </h3>

                        <TrackCommentForm trackUrn={track.urn} />

                        {commentsLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2
                                    size={18}
                                    className="text-white/15 animate-spin"
                                />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="text-center py-8">
                                <MessageCircle
                                    size={28}
                                    className="text-white/10 mx-auto mb-2"
                                />
                                <p className="text-[12px] text-white/20">
                                    {t('track.noComments')}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {comments.map((c) => (
                                    <TrackCommentItem key={c.id} comment={c} />
                                ))}
                                <div
                                    ref={commentsSentinel}
                                    className="h-4 flex items-center justify-center"
                                >
                                    {fetchingMoreComments && (
                                        <Loader2
                                            size={14}
                                            className="text-white/15 animate-spin"
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                {/* Right column */}
                <div className="space-y-6">
                    {/* Artist card */}
                    <section
                        className="glass rounded-2xl p-4 cursor-pointer hover:bg-white/[0.04] transition-all duration-200 group/ac"
                        onClick={() =>
                            navigate(
                                `/user/${encodeURIComponent(track.user.urn)}`
                            )
                        }
                    >
                        <div className="flex items-center gap-3">
                            <img
                                src={
                                    replaceArtSize(
                                        track.user.avatar_url,
                                        't200x200'
                                    ) ?? ''
                                }
                                alt=""
                                className="w-12 h-12 rounded-full ring-1 ring-white/[0.08] group-hover/ac:ring-white/[0.15] transition-all duration-150"
                            />
                            <div className="min-w-0">
                                <p className="text-[13px] font-medium text-white/80 truncate group-hover/ac:text-white transition-colors">
                                    {track.user.username}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Posted date */}
                    <section className="flex items-center gap-2 text-[11px] text-white/25 px-1">
                        <Calendar size={12} />
                        <span>
                            {t('track.posted')}{' '}
                            {dateFormatted(track.created_at ?? '')}
                        </span>
                    </section>

                    {/* Favoriters */}
                    {favorites.length > 0 && (
                        <section className="glass rounded-2xl p-4">
                            <h3 className="text-[12px] font-semibold text-white/40 mb-3">
                                {t('track.favoriters')}
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                                {favorites.map((u) => (
                                    <img
                                        key={u.urn}
                                        src={
                                            replaceArtSize(
                                                u.avatar_url,
                                                'small'
                                            ) ?? ''
                                        }
                                        alt={u.username}
                                        title={u.username}
                                        className="w-8 h-8 rounded-full ring-1 ring-white/[0.06] hover:ring-white/[0.15] transition-all duration-150 cursor-pointer"
                                        onClick={() =>
                                            navigate(
                                                `/user/${encodeURIComponent(u.urn)}`
                                            )
                                        }
                                    />
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Related tracks */}
                    <section>
                        <h3 className="text-[13px] font-semibold text-white/50 mb-3 flex items-center gap-2 px-1">
                            <Music size={14} />
                            {t('track.related')}
                        </h3>
                        {relatedLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2
                                    size={16}
                                    className="text-white/15 animate-spin"
                                />
                            </div>
                        ) : relatedTracks.length === 0 ? (
                            <p className="text-[12px] text-white/20 px-1">
                                No related tracks
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {relatedTracks.map((rt) => (
                                    <TrackRelatedRow
                                        key={rt.urn}
                                        track={rt}
                                        queue={relatedTracks}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    )
}
export const TrackPage = React.memo(TrackPageBase)
