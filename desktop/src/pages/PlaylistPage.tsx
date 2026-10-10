import type {DragEndEvent} from '@dnd-kit/core';
import * as Dialog from '@radix-ui/react-dialog';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams} from 'react-router-dom';
import {toast} from 'sonner';
import {useShallow} from 'zustand/shallow';
import {TrackSortMenu} from '../components/music/TrackSortMenu';
import {OfflineCopyLink} from '../components/offline/OfflineCopyLink';
import {CrateLedger} from '../components/playlist/CrateLedger';
import {EditPlaylistDialog} from '../components/playlist/EditPlaylistDialog';
import {PLAYLIST_KEYFRAMES} from '../components/playlist/keyframes';
import {MoreCrates} from '../components/playlist/MoreCrates';
import {PlaylistHero} from '../components/playlist/PlaylistHero';
import {SequenceList} from '../components/playlist/SequenceList';
import {SetRibbon} from '../components/playlist/SetRibbon';
import {usePlaylistAura} from '../components/playlist/usePlaylistAura';
import {Atmosphere} from '../components/search/Atmosphere';
import {LoadErrorState, RefreshPendingHint} from '../components/ui/LoadErrorState';
import {SyncNotice, syncNoticeOf} from '../components/ui/SyncNotice';
import {playlistScope} from '../lib/bulk-cache';
import {
    useDeletePlaylist,
    useInfiniteScroll,
    usePlaylist,
    usePlaylistTracks,
    useRemoveFromPlaylist,
    useUpdatePlaylistTracks,
} from '../lib/hooks';
import {usePlaylistDelivery} from '../lib/playlist-delivery';
import {AlertCircle, Check, ChevronLeft, X} from '../lib/icons';
import {usePerfMode} from '../lib/perf';
import {rawPlaylistCover} from '../lib/playlist-cover';
import {armPlaylistContinuation} from '../lib/queue-continuation';
import {type ArrangeMode, arrangeTracks} from '../lib/track-order';
import {sortTracks, type TrackSort} from '../lib/track-sort';
import {useAuthStore} from '../stores/auth';
import {type Track, usePlayerStore} from '../stores/player';
import {useSettingsStore} from '../stores/settings';

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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();
  const myUrn = useAuthStore((s) => s.user?.urn);

  const {
    data: playlist,
    isLoading: playlistLoading,
    isError: playlistFailed,
    isFetching: playlistFetching,
    error: playlistError,
    failureReason: playlistFailureReason,
    refetch: refetchPlaylist,
  } = usePlaylist(urn);
  const {
    tracks: playlistTracks,
    isLoading: tracksLoading,
    isError: tracksFailed,
    refetch: refetchTracks,
    syncState: tracksSyncState,
    sync: tracksSync,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usePlaylistTracks(playlist ? urn : undefined);
  const updateTracks = useUpdatePlaylistTracks(urn);
  const removeTrack = useRemoveFromPlaylist(urn);
  const deletePlaylist = useDeletePlaylist();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const { pinnedPlaylists, pinPlaylist, unpinPlaylist, setPlaylistSort } = useSettingsStore(
    useShallow((s) => ({
      pinnedPlaylists: s.pinnedPlaylists,
      pinPlaylist: s.pinPlaylist,
      unpinPlaylist: s.unpinPlaylist,
      setPlaylistSort: s.setPlaylistSort,
    })),
  );
  const sort = useSettingsStore((s): TrackSort => (urn && s.playlistSorts[urn]) || 'default');
  const sorted = sort !== 'default';
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;
  const [query, setQuery] = useState('');
  const filtering = query.trim() !== '';

  useEffect(() => {
    if (urn) setQuery('');
  }, [urn]);
  const changeSort = useCallback(
    (next: TrackSort) => {
      if (urn) setPlaylistSort(urn, next);
    },
    [urn, setPlaylistSort],
  );

  const isLoading = playlistLoading || tracksLoading;
  const isOwner = !!playlist && !!myUrn && playlist.user.urn === myUrn;
  const delivery = usePlaylistDelivery(urn, isOwner ? tracksSync : undefined);
  const isPinned = pinnedPlaylists.some((item) => item.urn === playlist?.urn);

  const serverTracks: Track[] = useMemo(() => {
    if (isLoading || !playlist) return [];
    return playlistTracks.length > 0 ? playlistTracks : (playlist.tracks ?? []);
  }, [isLoading, playlist, playlistTracks]);

  const [localTracks, setLocalTracks] = useState<Track[]>([]);
  const pendingMutationRef = useRef(false);
  const pendingRemovalsRef = useRef(0);
  useEffect(() => {
    if (!pendingMutationRef.current && pendingRemovalsRef.current === 0) {
      setLocalTracks(serverTracks);
    }
  }, [serverTracks]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(null!);
  const debouncedUpdate = useCallback(
    (next: Track[], onSaved?: () => void) => {
      pendingMutationRef.current = true;
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        updateTracks.mutate(
          next.map((tr) => tr.urn),
          {
            onSuccess: () => {
              pendingMutationRef.current = false;
              onSaved?.();
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

  const toastReordered = useCallback(() => toast.success(t('playlist.reordered')), [t]);

  const ownTracks = isOwner ? localTracks : serverTracks;
  const tracks = useMemo(
    () => sortTracks(ownTracks, sort, i18n.language),
    [ownTracks, sort, i18n.language],
  );

  const loadAll = sorted || filtering;
  useEffect(() => {
    if (loadAll && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [loadAll, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const trackUrnSet = useMemo(() => new Set(ownTracks.map((tr) => tr.urn)), [ownTracks]);
  const { isPausedFromThis, isPlayingFromThis } = usePlayerStore(
    useShallow((s) => ({
      isPlayingFromThis:
        s.isPlaying && s.currentTrack != null && trackUrnSet.has(s.currentTrack.urn),
      isPausedFromThis:
        !s.isPlaying && s.currentTrack != null && trackUrnSet.has(s.currentTrack.urn),
    })),
  );

  const aura = usePlaylistAura(ownTracks, playlist?.genre);
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
      debouncedUpdate(next, toastReordered);
    },
    [localTracks, debouncedUpdate, toastReordered],
  );

  const commitOrder = useCallback(
    (next: Track[]) => {
      const previous = localTracks;
      changeSort('default');
      setLocalTracks(next);
      debouncedUpdate(next, () =>
        toast.success(t('playlist.arranged'), {
          action: {
            label: t('playlist.undo'),
            onClick: () => {
              setLocalTracks(previous);
              debouncedUpdate(previous, toastReordered);
            },
          },
        }),
      );
    },
    [localTracks, debouncedUpdate, toastReordered, changeSort, t],
  );

  const handleArrange = useCallback(
    (mode: ArrangeMode) => commitOrder(arrangeTracks(localTracks, mode, i18n.language)),
    [commitOrder, localTracks, i18n.language],
  );

  const handleRemoveTrack = useCallback(
    (trackUrn: string) => {
      const index = localTracks.findIndex((tr) => tr.urn === trackUrn);
      if (index === -1) return;
      const removed = localTracks[index];
      setLocalTracks((current) => current.filter((tr) => tr.urn !== trackUrn));
      if (pendingMutationRef.current) {
        debouncedUpdate(
          localTracks.filter((tr) => tr.urn !== trackUrn),
          toastReordered,
        );
      }
      pendingRemovalsRef.current += 1;
      removeTrack
        .mutateAsync(trackUrn)
        .then(() => toast.success(t('playlist.trackRemoved')))
        .catch(() =>
          setLocalTracks((current) => {
            if (current.some((tr) => tr.urn === trackUrn)) return current;
            const next = [...current];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          }),
        )
        .finally(() => {
          pendingRemovalsRef.current -= 1;
        });
    },
    [localTracks, removeTrack, debouncedUpdate, toastReordered, t],
  );

  const armContinuation = useCallback(() => {
    if (urn && !sortedRef.current) armPlaylistContinuation(urn);
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
      artworkUrl: rawPlaylistCover(playlist.artwork_url, ownTracks),
    });
    toast.success(t('sidebar.pinned'));
  }, [playlist, isPinned, unpinPlaylist, pinPlaylist, ownTracks, t]);

  const handleDelete = useCallback(() => {
    if (!playlist) return;
    deletePlaylist.mutate(playlist.urn, {
      onSuccess: () => {
        toast.success(t('playlist.deleted'));
        navigate(-1);
      },
    });
  }, [playlist, deletePlaylist, navigate, t]);

  const editedInApp = (tracksSync?.lastOperationSequence ?? 0) > 0;
  const declaredCount = editedInApp
    ? (tracksSync?.projectionTrackCount ?? 0)
    : (playlist?.track_count ?? 0);
  const missingTracks = !hasNextPage && serverTracks.length < declaredCount;
  const tracksSyncStatus = tracksSync?.status ?? '';
  const tracksUnreadable =
    tracksSyncStatus === 'auth_required' || tracksSync?.conflictCode === 'remote_not_found';
  const listNotice = useMemo(() => {
    const retry = () => void refetchTracks();
    const notice = syncNoticeOf({
      isError: tracksFailed && serverTracks.length === 0,
      syncState: missingTracks ? tracksSyncState : 'complete',
    });
    if (notice) return <SyncNotice kind={notice} onRetry={retry} />;
    if (!missingTracks) return null;
    if (tracksUnreadable) {
      return <SyncNotice kind="failed" text={t('playlist.tracksUnavailable')} onRetry={retry} />;
    }
    return (
      <p className="text-center text-[13px] text-white/30">
        {t('playlist.partialTracks', {
          shown: serverTracks.length,
          total: declaredCount,
          count: declaredCount,
        })}
      </p>
    );
  }, [
    tracksFailed,
    tracksSyncState,
    tracksUnreadable,
    missingTracks,
    serverTracks.length,
    declaredCount,
    refetchTracks,
    t,
  ]);

  if (!playlist && playlistFailed) {
    return (
      <div className="relative min-h-full w-full flex flex-col items-center justify-center gap-5">
        {perf.atmosphere && <Atmosphere />}
        <LoadErrorState
          error={playlistError}
          retrying={playlistFetching}
          onRetry={() => void refetchPlaylist()}
        />
        {urn && <OfflineCopyLink scope={playlistScope(urn)} />}
      </div>
    );
  }

  if (isLoading || !playlist) {
    return (
      <div className="relative min-h-full w-full">
        <style>{PLAYLIST_KEYFRAMES}</style>
        {perf.atmosphere && <Atmosphere />}
        <div
          className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-8 pt-5 pb-10"
          style={{ isolation: 'isolate' }}
        >
          <HeroSkeleton />
          <RefreshPendingHint reason={playlistFailureReason} />
        </div>
      </div>
    );
  }

  const trackCount = declaredCount || tracks.length;
  const canArrange = !hasNextPage && localTracks.length > 1;
  const sortToolbar = (
    <div className="flex items-center gap-2">
      {isOwner && sorted && canArrange && (
        <button
          type="button"
          onClick={() => commitOrder(tracks)}
          title={t('trackSort.saveOrderHint')}
          aria-label={t('trackSort.saveOrder')}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border border-white/[0.07] bg-white/[0.03] px-3 text-[11.5px] font-semibold text-white/60 transition-all duration-200 ease-[var(--ease-apple)] hover:border-white/[0.14] hover:text-white/90 active:scale-[0.97]"
        >
          <Check size={12} />
          <span className="hidden sm:inline">{t('trackSort.saveOrder')}</span>
        </button>
      )}
      <TrackSortMenu
        sort={sort}
        context="playlist"
        loading={sorted && !!hasNextPage}
        onSort={changeSort}
      />
    </div>
  );

  return (
    <div className="relative min-h-full w-full">
      <style>{PLAYLIST_KEYFRAMES}</style>
      {perf.atmosphere && (
        <Atmosphere
          tint={aura.tint}
          energy={isPlayingFromThis ? Math.min(1, aura.energy + 0.12) : aura.energy}
        />
      )}

      <div
        className="relative z-10 max-w-[1320px] mx-auto px-4 md:px-8 pt-5 pb-10 space-y-7"
        style={{ isolation: 'isolate' }}
      >
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
          tracks={ownTracks}
          aura={aura}
          isOwner={isOwner}
          isPlaying={isPlayingFromThis}
          isPinned={isPinned}
          trackCount={trackCount}
          onPlayAll={handlePlayAll}
          onShuffle={handleShuffle}
          onTogglePin={handleTogglePin}
          onEdit={() => setShowEdit(true)}
          onDelete={() => setShowDeleteConfirm(true)}
          canArrange={canArrange}
          onArrange={handleArrange}
          delivery={delivery}
        />

        <CrateLedger playlist={playlist} tracks={ownTracks} accentGlow={aura.accentGlow} />

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
          notice={listNotice}
          toolbar={tracks.length > 1 ? sortToolbar : undefined}
          query={query}
          searching={filtering && !!hasNextPage}
          onQueryChange={setQuery}
          reorderable={isOwner && !sorted}
          onDragEnd={handleDragEnd}
          onRemove={isOwner ? handleRemoveTrack : undefined}
          onPlay={filtering ? undefined : armContinuation}
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

      {isOwner && (
        <EditPlaylistDialog playlist={playlist} open={showEdit} onOpenChange={setShowEdit} />
      )}

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
