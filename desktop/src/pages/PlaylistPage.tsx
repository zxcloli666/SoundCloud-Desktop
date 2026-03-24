import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { LikeButton } from '../components/music/LikeButton';
import { CopyLinkButton } from '../components/ui/CopyLinkButton';
import { VirtualList } from '../components/ui/VirtualList';
import { api } from '../lib/api';
import { preloadTrack } from '../lib/audio';
import { art, dateFormatted, dur, durLong, fc } from '../lib/formatters';
import {
  useDeletePlaylist,
  useInfiniteScroll,
  usePlaylist,
  usePlaylistTracks,
  useUpdatePlaylistTracks,
} from '../lib/hooks';
import {
  AlertCircle,
  Calendar,
  Clock,
  GripVertical,
  Heart,
  headphones9,
  heart9,
  ListPlus,
  ListMusic,
  Loader2,
  MapPin,
  musicIcon12,
  pauseBlack22,
  pauseCurrent16,
  pauseWhite12,
  playBlack22,
  playCurrent16,
  playWhite12,
  Shuffle,
  Trash2,
  X,
} from '../lib/icons';
import { useTrackPlay } from '../lib/useTrackPlay';
import { useAuthStore } from '../stores/auth';
import { type Track, usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';

/* ── Playlist Like Button ─────────────────────────────────── */

const PlaylistLikeBtn = React.memo(
  ({ playlistUrn, count }: { playlistUrn: string; count?: number }) => {
    const { data: likeStatus } = useQuery({
      queryKey: ['likes', 'playlist', playlistUrn],
      queryFn: () => api<{ liked: boolean }>(`/likes/playlists/${encodeURIComponent(playlistUrn)}`),
      staleTime: 1000 * 60 * 5,
    });

    const [liked, setLiked] = useState(false);
    const [localCount, setLocalCount] = useState(count ?? 0);
    const qc = useQueryClient();

    useEffect(() => {
      if (likeStatus) setLiked(likeStatus.liked);
    }, [likeStatus]);
    useEffect(() => {
      setLocalCount(count ?? 0);
    }, [count]);

    const toggle = async () => {
      const next = !liked;
      setLiked(next);
      setLocalCount((c) => c + (next ? 1 : -1));
      try {
        await api(`/likes/playlists/${encodeURIComponent(playlistUrn)}`, {
          method: next ? 'POST' : 'DELETE',
        });
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ['likes', 'playlist', playlistUrn] });
          qc.invalidateQueries({ queryKey: ['me', 'likes', 'playlists'] });
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
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
          liked
            ? 'bg-accent/15 text-accent border border-accent/20 shadow-[0_0_20px_rgba(255,85,0,0.1)]'
            : 'glass hover:bg-white/[0.05] text-white/60 hover:text-white/80'
        }`}
      >
        <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
        <span className="tabular-nums">{fc(localCount)}</span>
      </button>
    );
  },
);

/* ── Sortable Track Row ───────────────────────────────────── */

const SortableTrackRow = React.memo(
  function SortableTrackRow({
    track,
    index,
    queue,
    isOwner,
    onRemove,
  }: {
    track: Track;
    index: number;
    queue: Track[];
    isOwner: boolean;
    onRemove?: (urn: string) => void;
  }) {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const cover = art(track.artwork_url, 't200x200');
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: track.urn,
      disabled: !isOwner,
    });

    return (
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.5 : 1,
          zIndex: isDragging ? 50 : undefined,
          contentVisibility: 'auto',
          containIntrinsicSize: '68px',
        }}
        className={`group flex items-center gap-3.5 px-4 py-3 rounded-xl transition-colors duration-200 ease-[var(--ease-apple)] select-none ${
          isThis ? 'bg-accent/[0.05] ring-1 ring-accent/15' : 'hover:bg-white/[0.03]'
        }`}
      >
        {isOwner && (
          <div
            className="w-5 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing text-white/15 hover:text-white/40 transition-colors"
            {...attributes}
            {...listeners}
          >
            <GripVertical size={14} />
          </div>
        )}

        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={togglePlay}
          onMouseEnter={() => preloadTrack(track.urn)}
        >
          {isThisPlaying ? (
            <div className="w-7 h-7 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-[0_0_12px_var(--color-accent-glow)]">
              {pauseWhite12}
            </div>
          ) : (
            <>
              <span className="text-[12px] text-white/25 tabular-nums font-medium group-hover:hidden">
                {index + 1}
              </span>
              <div className="hidden group-hover:flex w-7 h-7 rounded-full bg-white/10 items-center justify-center">
                {playWhite12}
              </div>
            </>
          )}
        </div>

        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/[0.06]">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
              {musicIcon12}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-[13px] font-medium truncate cursor-pointer transition-colors duration-150 ${
              isThis ? 'text-accent' : 'text-white/85 hover:text-white'
            }`}
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </p>
          <p
            className="text-[11px] text-white/30 truncate mt-0.5 cursor-pointer hover:text-white/50 transition-colors duration-150"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {track.user.username}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {track.playback_count != null && (
            <span className="text-[10px] text-white/20 tabular-nums flex items-center gap-0.5">
              {headphones9}
              {fc(track.playback_count)}
            </span>
          )}
          {(track.favoritings_count ?? track.likes_count) != null && (
            <span className="text-[10px] text-white/20 tabular-nums flex items-center gap-0.5">
              {heart9}
              {fc(track.favoritings_count ?? track.likes_count)}
            </span>
          )}
        </div>

        <LikeButton track={track} />

        <span className="text-[11px] text-white/25 tabular-nums font-medium shrink-0 w-10 text-right">
          {dur(track.duration)}
        </span>

        {isOwner && onRemove && (
          <button
            type="button"
            onClick={() => onRemove(track.urn)}
            className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 shrink-0"
            title={t('playlist.removeTrack')}
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn && prev.index === next.index && prev.isOwner === next.isOwner,
);

/* ── Non-sortable Track Row (for non-owner view) ─────────── */

const TrackRow = React.memo(
  function TrackRow({ track, index, queue }: { track: Track; index: number; queue: Track[] }) {
    const navigate = useNavigate();
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const cover = art(track.artwork_url, 't200x200');
    const handleAddToQueue = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      usePlayerStore.getState().addToQueueNext([track]);
    }, [track]);

    return (
      <div
        style={{ contentVisibility: 'auto', containIntrinsicSize: '68px' }}
        className={`group flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] select-none ${
          isThis ? 'bg-accent/[0.05] ring-1 ring-accent/15' : 'hover:bg-white/[0.03]'
        }`}
      >
        <div
          className="w-8 h-8 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={togglePlay}
          onMouseEnter={() => preloadTrack(track.urn)}
        >
          {isThisPlaying ? (
            <div className="w-7 h-7 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-[0_0_12px_var(--color-accent-glow)]">
              {pauseWhite12}
            </div>
          ) : (
            <>
              <span className="text-[12px] text-white/25 tabular-nums font-medium group-hover:hidden">
                {index + 1}
              </span>
              <div className="hidden group-hover:flex w-7 h-7 rounded-full bg-white/10 items-center justify-center">
                {playWhite12}
              </div>
            </>
          )}
        </div>

        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/[0.06]">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="w-full h-full object-cover"
              decoding="async"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
              {musicIcon12}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-[13px] font-medium truncate cursor-pointer transition-colors duration-150 ${
              isThis ? 'text-accent' : 'text-white/85 hover:text-white'
            }`}
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </p>
          <p
            className="text-[11px] text-white/30 truncate mt-0.5 cursor-pointer hover:text-white/50 transition-colors duration-150"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {track.user.username}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          {track.playback_count != null && (
            <span className="text-[10px] text-white/20 tabular-nums flex items-center gap-0.5">
              {headphones9}
              {fc(track.playback_count)}
            </span>
          )}
          {(track.favoritings_count ?? track.likes_count) != null && (
            <span className="text-[10px] text-white/20 tabular-nums flex items-center gap-0.5">
              {heart9}
              {fc(track.favoritings_count ?? track.likes_count)}
            </span>
          )}
        </div>

        <LikeButton track={track} />

        <span className="text-[11px] text-white/25 tabular-nums font-medium shrink-0 w-10 text-right">
          {dur(track.duration)}
        </span>

        <button
          type="button"
          onClick={handleAddToQueue}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 shrink-0"
        >
          <ListPlus size={15} />
        </button>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn &&
    prev.index === next.index &&
    prev.track.user_favorite === next.track.user_favorite,
);

/* ── Main: PlaylistPage ──────────────────────────────────── */

export const PlaylistPage = React.memo(() => {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const myUrn = useAuthStore((s) => s.user?.urn);
  const { data: playlist, isLoading: playlistLoading } = usePlaylist(urn);
  const {
    tracks: playlistTracks,
    isLoading: tracksLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePlaylistTracks(urn);
  const updateTracks = useUpdatePlaylistTracks(urn);
  const deletePlaylist = useDeletePlaylist();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { pinnedPlaylists, pinPlaylist, unpinPlaylist } = useSettingsStore(
    useShallow((s) => ({
      pinnedPlaylists: s.pinnedPlaylists,
      pinPlaylist: s.pinPlaylist,
      unpinPlaylist: s.unpinPlaylist,
    })),
  );

  const isLoading = playlistLoading || tracksLoading;
  const isOwner = !!playlist && !!myUrn && playlist.user.urn === myUrn;
  const isPinned = pinnedPlaylists.some((item) => item.urn === playlist?.urn);

  const serverTracks: Track[] = React.useMemo(() => {
    if (isLoading || !playlist) return [];
    return playlistTracks.length > 0 ? playlistTracks : (playlist.tracks ?? []);
  }, [isLoading, playlist, playlistTracks]);

  // Local track order for DnD
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  // Skip server sync while a debounced mutation is pending
  const pendingMutationRef = useRef(false);
  useEffect(() => {
    if (!pendingMutationRef.current) setLocalTracks(serverTracks);
  }, [serverTracks]);

  // Debounced mutation: accumulate rapid changes, only send the latest state
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(null!);
  const debouncedUpdate = useCallback(
    (tracks: Track[], successMsg?: string) => {
      pendingMutationRef.current = true;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        updateTracks.mutate(
          tracks.map((t) => t.urn),
          {
            onSuccess: () => {
              pendingMutationRef.current = false;
              if (successMsg) toast.success(successMsg);
            },
            onError: () => {
              pendingMutationRef.current = false;
              // Revert to server state on error
              setLocalTracks(serverTracks);
            },
          },
        );
      }, 600);
    },
    [updateTracks, serverTracks],
  );

  const tracks = isOwner ? localTracks : serverTracks;

  const trackUrnSet = React.useMemo(() => new Set(tracks.map((t) => t.urn)), [tracks]);
  const { isPausedFromThis, isPlayingFromThis } = usePlayerStore(
    useShallow((s) => ({
      isPlayingFromThis:
        s.isPlaying && s.currentTrack != null && trackUrnSet.has(s.currentTrack.urn),
      isPausedFromThis:
        !s.isPlaying && s.currentTrack != null && trackUrnSet.has(s.currentTrack.urn),
    })),
  );

  const scrollRef = useInfiniteScroll(hasNextPage ?? false, isFetchingNextPage, fetchNextPage);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localTracks.findIndex((t) => t.urn === active.id);
    const newIndex = localTracks.findIndex((t) => t.urn === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newTracks = [...localTracks];
    const [moved] = newTracks.splice(oldIndex, 1);
    newTracks.splice(newIndex, 0, moved);
    setLocalTracks(newTracks);
    debouncedUpdate(newTracks, t('playlist.reordered'));
  };

  const handleRemoveTrack = (trackUrn: string) => {
    const newTracks = localTracks.filter((t) => t.urn !== trackUrn);
    setLocalTracks(newTracks);
    debouncedUpdate(newTracks, t('playlist.trackRemoved'));
  };

  const handleTogglePin = () => {
    if (!playlist) return;

    if (isPinned) {
      unpinPlaylist(playlist.urn);
      toast.success(t('sidebar.unpinned'));
      return;
    }

    pinPlaylist({
      urn: playlist.urn,
      title: playlist.title,
      artworkUrl: playlist.artwork_url ?? tracks[0]?.artwork_url ?? null,
    });
    toast.success(t('sidebar.pinned'));
  };

  if (isLoading || !playlist) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="text-white/15 animate-spin" />
      </div>
    );
  }
  const cover = art(playlist.artwork_url, 't500x500') ?? art(tracks[0]?.artwork_url, 't500x500');

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    const { play, pause, resume } = usePlayerStore.getState();
    if (isPlayingFromThis) {
      pause();
    } else if (isPausedFromThis) {
      resume();
    } else {
      play(tracks[0], tracks);
    }
  };

  const handleShuffle = () => {
    if (tracks.length === 0) return;
    if (!usePlayerStore.getState().shuffle) {
      usePlayerStore.setState({ shuffle: true });
    }
    const random = tracks[Math.floor(Math.random() * tracks.length)];
    usePlayerStore.getState().play(random, tracks);
  };

  const handleDelete = () => {
    deletePlaylist.mutate(playlist.urn, {
      onSuccess: () => {
        toast.success(t('playlist.deleted'));
        navigate(-1);
      },
    });
  };

  return (
    <div className="p-6 pb-4 space-y-7 animate-fade-in-up">
      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative rounded-3xl overflow-hidden glass-featured">
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
            className="relative w-[200px] h-[200px] rounded-2xl overflow-hidden shrink-0 shadow-2xl ring-1 ring-white/[0.1] cursor-pointer group/cover"
            onClick={handlePlayAll}
          >
            {cover ? (
              <img
                src={cover}
                alt={playlist.title}
                className="w-full h-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover/cover:scale-[1.04]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
                <ListMusic size={48} className="text-white/15" />
              </div>
            )}

            {/* Play overlay */}
            <div
              className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
                isPlayingFromThis
                  ? 'bg-black/30 opacity-100'
                  : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${
                  isPlayingFromThis
                    ? 'bg-white scale-100'
                    : 'bg-white/90 scale-75 group-hover/cover:scale-100'
                }`}
              >
                {isPlayingFromThis ? pauseBlack22 : playBlack22}
              </div>
            </div>

            {/* Track count pill */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[10px] font-medium bg-black/50 backdrop-blur-md text-white/70 px-2 py-1 rounded-full">
              <ListMusic size={10} />
              {tracks.length}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 py-2">
            <span className="inline-block text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.06] mb-3 uppercase tracking-wider">
              {playlist.playlist_type || 'Playlist'}
            </span>

            <h1 className="text-2xl font-bold text-white/95 leading-tight mb-2 line-clamp-2">
              {playlist.title}
            </h1>

            {/* Artist */}
            <div
              className="flex items-center gap-2.5 mb-5 cursor-pointer group/artist"
              onClick={() => navigate(`/user/${encodeURIComponent(playlist.user.urn)}`)}
            >
              {playlist.user.avatar_url && (
                <img
                  src={art(playlist.user.avatar_url, 'small') ?? ''}
                  alt=""
                  className="w-6 h-6 rounded-full ring-1 ring-white/[0.08] group-hover/artist:ring-white/[0.15] transition-all duration-150"
                />
              )}
              <span className="text-[14px] text-white/50 group-hover/artist:text-white/70 transition-colors">
                {playlist.user.username}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={handlePlayAll}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer shadow-[0_0_20px_var(--color-accent-glow)] ${
                  isPlayingFromThis
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-accent text-accent-contrast hover:bg-accent-hover active:scale-[0.97]'
                }`}
              >
                {isPlayingFromThis ? pauseCurrent16 : playCurrent16}
                {t('playlist.playAll')}
              </button>

              <button
                type="button"
                onClick={handleShuffle}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium glass hover:bg-white/[0.05] text-white/60 hover:text-white/80 transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer"
              >
                <Shuffle size={16} />
                {t('playlist.shuffle')}
              </button>
              <button
                type="button"
                onClick={handleTogglePin}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
                  isPinned
                    ? 'bg-white/[0.08] text-white/85 border border-white/[0.12]'
                    : 'glass hover:bg-white/[0.05] text-white/60 hover:text-white/80'
                }`}
              >
                <MapPin size={16} />
                {isPinned ? t('sidebar.unpinPlaylist') : t('sidebar.pinPlaylist')}
              </button>
              <PlaylistLikeBtn playlistUrn={playlist.urn} count={playlist.likes_count} />
              <CopyLinkButton url={playlist.permalink_url} />
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium glass hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer"
                >
                  <Trash2 size={16} />
                  {t('playlist.delete')}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────── */}
      <section className="flex items-center gap-5 px-1 flex-wrap">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30">
          <ListMusic size={13} className="text-white/20" />
          <span className="tabular-nums font-medium">{tracks.length}</span>
          <span className="text-white/15">{t('search.tracks').toLowerCase()}</span>
        </div>
        {playlist.likes_count != null && (
          <div className="flex items-center gap-1.5 text-[12px] text-white/30">
            <Heart size={13} className="text-white/20" />
            <span className="tabular-nums font-medium">{fc(playlist.likes_count)}</span>
            <span className="text-white/15">{t('track.likes')}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-[12px] text-white/25 ml-auto">
          <Clock size={12} />
          <span className="tabular-nums">{durLong(playlist.duration)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/20">
          <Calendar size={12} />
          <span>{dateFormatted(playlist.created_at)}</span>
        </div>
      </section>

      {/* ── Description ──────────────────────────────── */}
      {playlist.description && (
        <section className="glass rounded-2xl p-5">
          <p className="text-[13px] text-white/45 leading-relaxed whitespace-pre-wrap break-words">
            {playlist.description}
          </p>
        </section>
      )}

      {/* ── Track list ───────────────────────────────── */}
      <section>
        {tracks.length === 0 ? (
          <div className="text-center py-12">
            <ListMusic size={32} className="text-white/10 mx-auto mb-3" />
            <p className="text-[13px] text-white/20">{t('playlist.noTracks')}</p>
          </div>
        ) : isOwner ? (
          <div className="space-y-0.5">
            {/* Header */}
            <div className="flex items-center gap-3.5 px-4 py-2 text-[10px] text-white/20 uppercase tracking-wider font-medium">
              <span className="w-5" />
              <span className="w-8 text-center">#</span>
              <span className="w-10" />
              <span className="flex-1">Title</span>
              <span className="hidden sm:block w-[100px]" />
              <span className="w-10 text-right">
                <Clock size={10} className="inline" />
              </span>
              <span className="w-7" />
            </div>
            <div className="h-px bg-white/[0.04] mx-4 mb-1" />

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={tracks.map((t) => t.urn)}
                strategy={verticalListSortingStrategy}
              >
                <VirtualList
                  items={tracks}
                  rowHeight={68}
                  overscan={10}
                  className="space-y-0.5"
                  getItemKey={(track) => track.urn}
                  renderItem={(track, i) => (
                    <SortableTrackRow
                      track={track}
                      index={i}
                      queue={tracks}
                      isOwner={true}
                      onRemove={handleRemoveTrack}
                    />
                  )}
                />
              </SortableContext>
            </DndContext>
            {hasNextPage && (
              <div ref={scrollRef} className="flex justify-center py-4">
                {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-white/30" />}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-0.5">
            {/* Header */}
            <div className="flex items-center gap-3.5 px-4 py-2 text-[10px] text-white/20 uppercase tracking-wider font-medium">
              <span className="w-8 text-center">#</span>
              <span className="w-10" />
              <span className="flex-1">Title</span>
              <span className="hidden sm:block w-[100px]" />
              <span className="w-10 text-right">
                <Clock size={10} className="inline" />
              </span>
            </div>
            <div className="h-px bg-white/[0.04] mx-4 mb-1" />

            <VirtualList
              items={tracks}
              rowHeight={68}
              overscan={10}
              className="space-y-0.5"
              getItemKey={(track) => track.urn}
              renderItem={(track, i) => <TrackRow track={track} index={i} queue={tracks} />}
            />
            {hasNextPage && (
              <div ref={scrollRef} className="flex justify-center py-4">
                {isFetchingNextPage && <Loader2 size={20} className="animate-spin text-white/30" />}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Delete confirmation ────────────────────── */}
      <Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[380px] rounded-2xl glass border border-white/[0.08] shadow-2xl animate-fade-in-up p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <Dialog.Title className="text-[15px] font-bold text-white/90">
                {t('playlist.delete')}
              </Dialog.Title>
              <Dialog.Close className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all">
                <X size={14} />
              </Dialog.Close>
            </div>
            <p className="text-[13px] text-white/50 leading-relaxed">
              {t('playlist.deleteConfirm', { title: playlist.title })}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Dialog.Close className="px-4 py-2 rounded-xl text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-all cursor-pointer">
                {t('common.cancel') ?? 'Cancel'}
              </Dialog.Close>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deletePlaylist.isPending}
                className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {deletePlaylist.isPending ? t('common.loading') : t('playlist.delete')}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
});
