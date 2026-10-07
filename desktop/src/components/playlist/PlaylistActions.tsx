import {useQuery, useQueryClient} from '@tanstack/react-query';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {api} from '../../lib/api';
import {playlistScope} from '../../lib/bulk-cache';
import {fc} from '../../lib/formatters';
import {fetchAllPlaylistTracks, type Playlist} from '../../lib/hooks';
import {
    Check,
    Heart,
    LinkIcon,
    MapPin,
    pauseCurrent16,
    playCurrent16,
    Shuffle,
    Trash2,
} from '../../lib/icons';
import {rawPlaylistCover} from '../../lib/playlist-cover';
import type {Track} from '../../stores/player';
import {SaveCollectionMenu} from '../collection-save/SaveCollectionMenu';
import {SharingToggle} from '../music/SharingToggle';

const PlaylistLikeBtn = React.memo(function PlaylistLikeBtn({
                                                                playlistUrn,
                                                                count,
                                                            }: {
    playlistUrn: string;
    count?: number;
}) {
    const {t} = useTranslation();
    const {data: likeStatus} = useQuery({
        queryKey: ['likes', 'playlist', playlistUrn],
        queryFn: () => api<{ liked: boolean }>(`/likes/playlists/${encodeURIComponent(playlistUrn)}`),
        staleTime: 1000 * 60 * 5,
    });
    const [liked, setLiked] = useState(false);
    const [localCount, setLocalCount] = useState(count ?? 0);
    const qc = useQueryClient();
    const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (likeStatus) setLiked(likeStatus.liked);
    }, [likeStatus]);
    useEffect(() => setLocalCount(count ?? 0), [count]);
    useEffect(() => () => clearTimeout(invalidateTimer.current ?? undefined), []);

    const toggle = async () => {
        const next = !liked;
        setLiked(next);
        setLocalCount((c) => c + (next ? 1 : -1));
        try {
            await api(`/likes/playlists/${encodeURIComponent(playlistUrn)}`, {
                method: next ? 'POST' : 'DELETE',
            });
            invalidateTimer.current = setTimeout(() => {
                qc.invalidateQueries({queryKey: ['likes', 'playlist', playlistUrn]});
                qc.invalidateQueries({queryKey: ['me', 'likes', 'playlists']});
            }, 3000);
        } catch {
            setLiked(!next);
            setLocalCount((c) => c + (next ? -1 : 1));
        }
    };

    return (
        <button
            type="button"
            onClick={toggle}
            title={t('track.likes')}
            className={`inline-flex items-center gap-1.5 px-3.5 h-11 rounded-2xl text-[12.5px] font-semibold tabular-nums transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer border active:scale-[0.96] ${
                liked
                    ? 'bg-accent/15 text-accent border-accent/30 shadow-[0_0_18px_var(--color-accent-glow)]'
                    : 'bg-white/[0.04] border-white/[0.07] text-white/65 hover:bg-white/[0.07] hover:text-white/90 hover:border-white/[0.12]'
            }`}
        >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'}/>
            <span>{fc(localCount)}</span>
        </button>
    );
});

const CopyIconAction = React.memo(function CopyIconAction({url}: { url?: string }) {
    const {t} = useTranslation();
    const [copied, setCopied] = useState(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => clearTimeout(copyTimer.current ?? undefined), []);
    if (!url) return null;
    const copy = () => {
        try {
            const u = new URL(url);
            for (const p of ['utm_medium', 'utm_campaign', 'utm_source']) u.searchParams.delete(p);
            navigator.clipboard.writeText(u.toString().replace(/\?$/, ''));
        } catch {
            navigator.clipboard.writeText(url);
        }
        setCopied(true);
        copyTimer.current = setTimeout(() => setCopied(false), 1600);
    };
    return (
        <button
            type="button"
            onClick={copy}
            title={copied ? t('auth.copied') : t('auth.copyLink')}
            aria-label={copied ? t('auth.copied') : t('auth.copyLink')}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
                copied
                    ? 'text-emerald-400 bg-emerald-500/12'
                    : 'text-white/60 hover:text-white/95 hover:bg-white/[0.07]'
            }`}
        >
            {copied ? <Check size={16}/> : <LinkIcon size={16}/>}
        </button>
    );
});

/** The crate's full control bar — Play the Set, Shuffle, Pin, Like + utility rail. */
export const PlaylistActions = React.memo(function PlaylistActions({
                                                                       playlist,
                                                                       isOwner,
                                                                       isPlaying,
                                                                       isPinned,
                                                                       tracks,
                                                                       trackCount,
                                                                       onPlayAll,
                                                                       onShuffle,
                                                                       onTogglePin,
                                                                       onDelete,
                                                                   }: {
    playlist: Playlist;
    isOwner: boolean;
    isPlaying: boolean;
    isPinned: boolean;
    tracks: Track[];
    trackCount: number;
    onPlayAll: () => void;
    onShuffle: () => void;
    onTogglePin: () => void;
    onDelete: () => void;
}) {
    const {t} = useTranslation();
    const playlistUrn = playlist.urn;
    const collect = useCallback(() => fetchAllPlaylistTracks(playlistUrn), [playlistUrn]);
    const coverSource = tracks.length > 0 ? tracks : playlist.tracks;
    const meta = useMemo(
        () => ({
            kind: 'playlist' as const,
            title: playlist.title,
            author: playlist.user.username,
            artworkUrl: rawPlaylistCover(playlist.artwork_url, coverSource),
        }),
        [playlist.title, playlist.user.username, playlist.artwork_url, coverSource],
    );

    return (
        <div className="flex items-center gap-3 flex-wrap justify-center lg:justify-start">
            <button
                type="button"
                onClick={onPlayAll}
                className={`group relative overflow-hidden inline-flex items-center gap-2.5 pl-4 pr-6 h-11 rounded-full text-[14px] font-semibold transition-all duration-500 ease-[var(--ease-apple)] cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
                    isPlaying ? 'bg-white text-black' : 'bg-accent text-accent-contrast'
                }`}
                style={{
                    boxShadow: '0 12px 32px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.3)',
                }}
            >
        <span
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-[var(--ease-apple)] pointer-events-none"
            style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',
            }}
        />
                {isPlaying ? pauseCurrent16 : playCurrent16}
                {t('playlist.playAll')}
            </button>

            <button
                type="button"
                onClick={onShuffle}
                title={t('playlist.shuffle')}
                className="inline-flex items-center gap-1.5 px-3.5 h-11 rounded-2xl text-[12.5px] font-semibold border bg-white/[0.04] border-white/[0.07] text-white/65 hover:bg-white/[0.07] hover:text-white/90 hover:border-white/[0.12] transition-all duration-300 ease-[var(--ease-apple)] cursor-pointer active:scale-[0.96]"
            >
                <Shuffle size={14}/>
                <span className="hidden sm:inline">{t('playlist.shuffle')}</span>
            </button>

            <PlaylistLikeBtn playlistUrn={playlist.urn} count={playlist.likes_count}/>

            <div
                className="flex items-center gap-0.5 h-11 px-1.5 rounded-2xl"
                style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '0.5px solid rgba(255,255,255,0.07)',
                }}
            >
                <button
                    type="button"
                    onClick={onTogglePin}
                    title={isPinned ? t('sidebar.unpinPlaylist') : t('sidebar.pinPlaylist')}
                    aria-label={isPinned ? t('sidebar.unpinPlaylist') : t('sidebar.pinPlaylist')}
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
                        isPinned
                            ? 'text-accent bg-accent/15'
                            : 'text-white/60 hover:text-white/95 hover:bg-white/[0.07]'
                    }`}
                >
                    <MapPin size={16}/>
                </button>
                <CopyIconAction url={playlist.permalink_url}/>
                <SaveCollectionMenu
                    scope={playlistScope(playlist.urn)}
                    meta={meta}
                    tracks={tracks}
                    trackCount={trackCount}
                    collect={collect}
                    variant="rail"
                />
                {isOwner && (
                    <>
                        <span className="w-px h-5 bg-white/[0.08] mx-0.5" aria-hidden/>
                        <SharingToggle kind="playlist" urn={playlist.urn} sharing={playlist.sharing}/>
                        <button
                            type="button"
                            onClick={onDelete}
                            title={t('playlist.delete')}
                            aria-label={t('playlist.delete')}
                            className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-white/55 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 cursor-pointer"
                        >
                            <Trash2 size={16}/>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
});
