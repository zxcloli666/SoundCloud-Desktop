import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useShallow} from 'zustand/shallow';
import {art} from '../../../lib/formatters';
import {Loader2, pauseBlack14, playBlack14} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';
import {recordClusterFeedback, setUrnCluster, useClusterFeedback,} from '../../../lib/recsFeedback';
import {useArtistLinkItems, useDisplayTitle} from '../../../lib/track-display';
import {useAutoHide} from '../../../lib/useAutoHide';
import {useTrackContextMenu} from '../../../lib/useTrackContextMenu';
import {type Track, usePlayerStore} from '../../../stores/player';
import {ArtistNameLinks} from '../ArtistNameLinks';
import {LikeButton} from '../LikeButton';
import {TrackStatusBadges} from '../TrackStatusBadges';
import type {ClusterNeighborDto} from './types';

interface Props {
  neighbor: ClusterNeighborDto;
  track: Track;
  queue: Track[];
  /** If provided, called on first play to build an async queue (e.g. same_artist similar). */
  resolveQueue?: (track: Track) => Promise<Track[]>;
}

export const NeighborCard = React.memo(function NeighborCard({
  neighbor,
  track,
  queue,
  resolveQueue,
}: Props) {
  const navigate = useNavigate();
  const perf = usePerfMode();
  const displayTitle = useDisplayTitle(track);
  const artistLinks = useArtistLinkItems(track);
  const { isThis, isThisPlaying } = usePlayerStore(
    useShallow((s) => {
      const isThis = s.currentTrack?.urn === track.urn;
      return { isThis, isThisPlaying: isThis && s.isPlaying };
    }),
  );
  const showPlayingOverlay = useAutoHide(isThisPlaying);
  const onContextMenu = useTrackContextMenu(track);
  const clusterId = useClusterFeedback();
  const [resolving, setResolving] = useState(false);

  const togglePlay = React.useCallback(async () => {
    if (clusterId) {
      setUrnCluster(track.urn, clusterId);
      recordClusterFeedback(clusterId, 'click');
    }
    const { play, pause, resume } = usePlayerStore.getState();
    if (isThisPlaying) {
      pause();
      return;
    }
    if (isThis) {
      resume();
      return;
    }
    if (resolveQueue) {
      if (resolving) return;
      setResolving(true);
      try {
        const resolved = await resolveQueue(track);
        play(track, resolved.length > 0 ? resolved : [track]);
      } catch {
        play(track, [track]);
      } finally {
        setResolving(false);
      }
      return;
    }
    play(track, queue.length > 0 ? queue : [track]);
  }, [clusterId, track, isThis, isThisPlaying, resolveQueue, resolving, queue]);
  const cover = art(track.artwork_url, 't300x300');
  const avatar = art(neighbor.avatar_url, 't120x120');

  const openArtist = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/artist/${encodeURIComponent(neighbor.artist_id)}`);
  };

  return (
    <div className="group relative w-full transition-transform duration-500 ease-[var(--ease-apple)] hover:scale-[1.02]">
      <button
        type="button"
        onClick={togglePlay}
        onContextMenu={onContextMenu}
        className="relative w-full text-left rounded-2xl overflow-hidden cursor-pointer transition-transform duration-500 ease-[var(--ease-apple)] active:scale-[0.99]"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: '0.5px solid color-mix(in srgb, var(--color-accent) 18%, transparent)',
          boxShadow:
            '0 18px 40px rgba(0,0,0,0.35), 0 0 30px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="relative aspect-square w-full overflow-hidden">
          {cover ? (
            <img
              src={cover}
              alt={track.title}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-[var(--ease-apple)] group-hover:scale-[1.06]"
            />
          ) : (
            <div className="absolute inset-0 bg-white/[0.04]" />
          )}

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 35%, transparent) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 90%)',
            }}
          />

          <span
            onClick={openArtist}
            role="link"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openArtist(e as unknown as React.MouseEvent);
              }
            }}
            className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 max-w-[calc(100%-58px)] pl-[3px] pr-2.5 h-7 rounded-full text-[10.5px] font-bold text-white cursor-pointer transition-all duration-300 hover:scale-105"
            style={{
              background: perf.blur(14) > 0 ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.78)',
              border: '0.5px solid color-mix(in srgb, var(--color-accent) 50%, transparent)',
              backdropFilter:
                perf.blur(14) > 0 ? `blur(${perf.blur(14)}px) saturate(160%)` : undefined,
              WebkitBackdropFilter:
                perf.blur(14) > 0 ? `blur(${perf.blur(14)}px) saturate(160%)` : undefined,
              boxShadow: '0 6px 16px rgba(0,0,0,0.4), 0 0 10px var(--color-accent-glow)',
            }}
          >
            {avatar ? (
              <img
                src={avatar}
                alt=""
                className="w-[22px] h-[22px] rounded-full object-cover ring-1 ring-white/30"
              />
            ) : (
              <span
                className="w-[22px] h-[22px] rounded-full"
                style={{
                  background: 'color-mix(in srgb, var(--color-accent) 60%, transparent)',
                }}
              />
            )}
            <span className="truncate">{neighbor.artist_name}</span>
          </span>

          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:opacity-100 ${
              showPlayingOverlay || resolving ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <span
              className="w-11 h-11 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{
                background: 'rgba(255,255,255,0.92)',
                boxShadow: '0 12px 36px rgba(0,0,0,0.45), 0 0 28px var(--color-accent-glow)',
              }}
            >
              {resolving ? (
                <Loader2 size={16} className="text-black animate-spin" />
              ) : isThisPlaying ? (
                pauseBlack14
              ) : (
                playBlack14
              )}
            </span>
          </div>

          <div className="absolute bottom-2 left-2 flex">
            <TrackStatusBadges meta={track._scd_meta} variant="overlay" />
          </div>
        </div>

        <div className="px-3 py-2.5">
          <p className="text-[12.5px] font-semibold text-white/95 truncate">{displayTitle}</p>
          <p className="text-[10.5px] text-white/40 truncate mt-0.5">
            <ArtistNameLinks
              items={artistLinks}
              linkClassName="cursor-pointer transition-colors hover:text-white/60"
            />
          </p>
        </div>
      </button>
      <LikeButton track={track} variant="overlay" position="top-2.5 right-2.5" />
    </div>
  );
});
