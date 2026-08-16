import type { DragEndEvent } from '@dnd-kit/core';
import * as Dialog from '@radix-ui/react-dialog';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useShallow } from 'zustand/shallow';
import { CrateLedger } from '../components/playlist/CrateLedger';
import { PLAYLIST_KEYFRAMES } from '../components/playlist/keyframes';
import { MoreCrates } from '../components/playlist/MoreCrates';
import { PlaylistHero } from '../components/playlist/PlaylistHero';
import { SequenceList } from '../components/playlist/SequenceList';
import { SetRibbon } from '../components/playlist/SetRibbon';
import { usePlaylistAura } from '../components/playlist/usePlaylistAura';
import {
  useDeletePlaylist,
  useInfiniteScroll,
  usePlaylist,
  usePlaylistTracks,
  useUpdatePlaylistTracks,
} from '../lib/hooks';
import { AlertCircle, ChevronLeft, X } from '../lib/icons';
import { rawPlaylistCover } from '../lib/playlist-cover';
import { armPlaylistContinuation } from '../lib/queue-continuation';
import { useAuthStore } from '../stores/auth';
import { type Track, usePlayerStore } from '../stores/player';
import { useSettingsStore } from '../stores/settings';

function HeroSkeleton() {
  return (
    <div className="relative rounded-[2.5rem] overflow-hidden glass-featured p-6 md:p-10">
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="w-[150px] h-[150px] md:w-[200px] md:h-[200px] rounded-[1.7rem] skeleton-shimmer shrink-0 self-center lg:self-start" />
        <div className="flex-1 space-y-4 w-full">
          <div className="h-4 w-32 rounded-full skeleton-shimmer" />
          <div className="h-14 w-2/3 rounded-2xl skeleton-shimmer" />
          <div className="h-11 w-72 rounded-full skeleton-shimmer mt-6" />
          <div className="h-24 w-full rounded-2xl skeleton-shimmer mt-4" />
        </div>
      </div>
    </div>
  );
}

export const PlaylistPage = React.memo(function PlaylistPage() {
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

  const serverTracks: Track[] = useMemo(() => {
    if (isLoading || !playlist) return [];
    return playlistTracks.length > 0 ? playlistTracks : (playlist.tracks ?? []);
  }, [isLoading, playlist, playlistTracks]);

  // Local order for DnD; skip server sync while a debounced save is in flight.
  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const pendingMutationRef = useRef(false);
  useEffect(() => {
    if (!pendingMutationRef.current) setLocalTracks(serverTracks);
  }, [serverTracks]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(null!);
  const debouncedUpdate = useCallback(
    (next: Track[], successMsg?: string) => {
      pendingMutationRef.current = true;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        updateTracks.mutate(
          next.map((tr) => tr.urn),
          {
            onSuccess: () => {
              pendingMutationRef.current = false;
              if (successMsg) toast.success(successMsg);
            },
            onError: () => {
              pendingMutationRef.current = false;
              setLocalTracks(serverTracks);
            },
          },
        );
      }, 600);
    },
    [updateTracks, serverTracks],
  );

  useEffect(() => () => clearTimeout(debounceTimerRef.current), []);

  const tracks = isOwner ? localTracks : serverTracks;

  const trackUrnSet = useMemo(() => new Set(tracks.map((tr) => tr.urn)), [tracks]);
  const { isPausedFromThis, isPlayingFromThis } = usePlayerStore(
    useShallow((s) => ({
      isPlayingFromThis:
        s.isPlaying && s.currentTrack != null && trackUrnSet.has(s.currentTrack.urn),
      isPausedFromThis:
        !s.isPlaying && s.currentTrack != null && trackUrnSet.has(s.currentTrack.urn),
    })),
  );

  const aura = usePlaylistAura(tracks, playlist?.genre);
  const scrollRef = useInfiniteScroll(hasNextPage ?? false, isFetchingNextPage, fetchNextPage);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = localTracks.findIndex((tr) => tr.urn === active.id);
      const newIndex = localTracks.findIndex((tr) => tr.urn === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const next = [...localTracks];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      setLocalTracks(next);
      debouncedUpdate(next, t('playlist.reordered'));
    },
    [localTracks, debouncedUpdate, t],
  );

  const handleRemoveTrack = useCallback(
    (trackUrn: string) => {
      const next = localTracks.filter((tr) => tr.urn !== trackUrn);
      setLocalTracks(next);
      debouncedUpdate(next, t('playlist.trackRemoved'));
    },
    [localTracks, debouncedUpdate, t],
  );

  // Доигрываем плейлист ДО КОНЦА (пагинированный срез в очереди → потом волна),
  // как у лайков. Армить ПОСЛЕ play(): он сбрасывает прошлый источник.
  const armContinuation = useCallback(() => {
    if (urn) armPlaylistContinuation(urn);
  }, [urn]);

  const handlePlayAll = useCallback(() => {
    if (tracks.length === 0) return;
    const { play, pause, resume } = usePlayerStore.getState();
    if (isPlayingFromThis) pause();
    else if (isPausedFromThis) resume();
    else {
      play(tracks[0], tracks);
      armContinuation();
    }
  }, [tracks, isPlayingFromThis, isPausedFromThis, armContinuation]);

  const handleShuffle = useCallback(() => {
    if (tracks.length === 0) return;
    const st = usePlayerStore.getState();
    if (!st.shuffle) usePlayerStore.setState({ shuffle: true });
    st.play(tracks[Math.floor(Math.random() * tracks.length)], tracks);
    armContinuation();
  }, [tracks, armContinuation]);

  const handleJump = useCallback(
    (index: number) => {
      if (index < 0 || index >= tracks.length) return;
      usePlayerStore.getState().play(tracks[index], tracks);
      armContinuation();
    },
    [tracks, armContinuation],
  );

  const handleTogglePin = useCallback(() => {
    if (!playlist) return;
    if (isPinned) {
      unpinPlaylist(playlist.urn);
      toast.success(t('sidebar.unpinned'));
      return;
    }
    pinPlaylist({
      urn: playlist.urn,
      title: playlist.title,
      artworkUrl: rawPlaylistCover(playlist.artwork_url, tracks),
    });
    toast.success(t('sidebar.pinned'));
  }, [playlist, isPinned, unpinPlaylist, pinPlaylist, tracks, t]);

  const handleDelete = useCallback(() => {
    if (!playlist) return;
    deletePlaylist.mutate(playlist.urn, {
      onSuccess: () => {
        toast.success(t('playlist.deleted'));
        navigate(-1);
      },
    });
  }, [playlist, deletePlaylist, navigate, t]);

  if (isLoading || !playlist) {
    return (
      <div className="sonveil-detail-page">
        <style>{PLAYLIST_KEYFRAMES}</style>
        <div className="sonveil-detail-content" style={{ isolation: 'isolate' }}>
          <HeroSkeleton />
        </div>
      </div>
    );
  }

  const trackCount = playlist.track_count || tracks.length;

  return (
    <div className="sonveil-detail-page">
      <style>{PLAYLIST_KEYFRAMES}</style>

      <div className="sonveil-detail-content space-y-7" style={{ isolation: 'isolate' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white/55 hover:text-white hover:bg-white/[0.06] transition-all duration-200 cursor-pointer"
          aria-label={t('search.back')}
        >
          <ChevronLeft size={18} />
        </button>

        <PlaylistHero
          playlist={playlist}
          tracks={tracks}
          aura={aura}
          isOwner={isOwner}
          isPlaying={isPlayingFromThis}
          isPinned={isPinned}
          trackCount={trackCount}
          onPlayAll={handlePlayAll}
          onShuffle={handleShuffle}
          onTogglePin={handleTogglePin}
          onDelete={() => setShowDeleteConfirm(true)}
        />

        <CrateLedger playlist={playlist} tracks={tracks} accentGlow={aura.accentGlow} />

        {tracks.length > 1 && (
          <div
            className="rounded-[2rem] p-5 md:p-6"
            style={{
              background: 'rgba(255,255,255,0.025)',
              border: '0.5px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-center gap-2 mb-4 text-[11px] font-bold uppercase tracking-[0.22em] text-white/45">
              {t('playlist.theSet')}
            </div>
            <SetRibbon tracks={tracks} onJump={handleJump} />
          </div>
        )}

        <SequenceList
          tracks={tracks}
          isOwner={isOwner}
          onDragEnd={handleDragEnd}
          onRemove={handleRemoveTrack}
          onPlay={armContinuation}
          sentinelRef={scrollRef}
          hasNextPage={hasNextPage ?? false}
          isFetchingNextPage={isFetchingNextPage}
        />

        <MoreCrates
          curatorUrn={playlist.user.urn}
          curatorName={playlist.user.username}
          excludeUrn={playlist.urn}
        />
      </div>

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
                {t('common.cancel')}
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
