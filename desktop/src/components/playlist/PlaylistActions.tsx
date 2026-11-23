import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import { playlistScope } from '../../lib/bulk-cache';
import { playlistEmbed } from '../../lib/chat/embed-snapshot';
import { fc } from '../../lib/formatters';
import { fetchAllPlaylistTracks, type Playlist } from '../../lib/hooks';
import {
  Check,
  Copy,
  Heart,
  ImagePlus,
  LinkIcon,
  MapPin,
  Pencil,
  pauseCurrent16,
  playCurrent16,
  Shuffle,
  Trash2,
} from '../../lib/icons';
import { patchLikedCollections } from '../../lib/liked-collections';
import { rawPlaylistCover } from '../../lib/playlist-cover';
import type { ArrangeMode } from '../../lib/track-order';
import type { Track } from '../../stores/player';
import { ShareButton } from '../chat/share/ShareButton';
import { SaveCollectionMenu } from '../collection-save/SaveCollectionMenu';
import { SharingToggle } from '../music/SharingToggle';
import { ArrangeMenu } from './ArrangeMenu';
import { DuplicatesDialog } from './DuplicatesDialog';

export const PlaylistLikeBtn = React.memo(function PlaylistLikeBtn({
  playlistUrn,
  playlist,
  count,
}: {
  playlistUrn: string;
  playlist?: Playlist;
  count?: number;
}) {
  const { t } = useTranslation();
  const { data: likeStatus } = useQuery({
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
    if (playlist) patchLikedCollections(qc, playlist, next);
    try {
      await api(`/likes/playlists/${encodeURIComponent(playlistUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      invalidateTimer.current = setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['likes', 'playlist', playlistUrn] });
        qc.invalidateQueries({ queryKey: ['me', 'likes', 'playlists'] });
      }, 3000);
    } catch {
      if (playlist) patchLikedCollections(qc, playlist, !next);
      setLiked(!next);
      setLocalCount((c) => c + (next ? -1 : 1));
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={count === undefined ? t('album.saveHint') : t('track.likes')}
      aria-pressed={liked}
      className={`inline-flex items-center gap-1.5 px-3.5 h-11 rounded-2xl text-[12.5px] font-semibold tabular-nums transition-colors duration-200 cursor-pointer border ${
        liked
          ? 'bg-accent/12 text-accent border-accent/30'
          : 'bg-ink/[0.04] border-ink/[0.07] text-ink-65 hover:bg-ink/[0.07] hover:text-ink-90 hover:border-ink/[0.12]'
      }`}
    >
      <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
      <span>
        {count === undefined ? (liked ? t('album.saved') : t('album.save')) : fc(localCount)}
      </span>
    </button>
  );
});

const CopyIconAction = React.memo(function CopyIconAction({ url }: { url?: string }) {
  const { t } = useTranslation();
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
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 cursor-pointer ${
        copied ? 'text-ok bg-ok/10' : 'text-ink-60 hover:text-ink-95 hover:bg-ink/[0.07]'
      }`}
    >
      {copied ? <Check size={16} /> : <LinkIcon size={16} />}
    </button>
  );
});

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
  onEdit,
  onChangeCover,
  onDelete,
  canArrange,
  onArrange,
  onRemoveDuplicates,
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
  onEdit: () => void;
  onChangeCover: () => void;
  onDelete: () => void;
  canArrange: boolean;
  onArrange: (mode: ArrangeMode) => void;
  onRemoveDuplicates: (indices: Set<number>) => void;
}) {
  const { t } = useTranslation();
  const [dupesOpen, setDupesOpen] = useState(false);
  const dupesLabel = canArrange ? t('playlist.dupes') : t('playlist.dupesWait');
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
  const shareEmbed = useMemo(
    () => playlistEmbed(playlist, null, coverSource ?? []),
    [playlist, coverSource],
  );

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center @min-[740px]:justify-start">
      <button
        type="button"
        onClick={onPlayAll}
        className="inline-flex h-11 cursor-pointer items-center gap-3 rounded-full bg-accent pl-2 pr-5 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-shade-15">
          {isPlaying ? pauseCurrent16 : playCurrent16}
        </span>
        {isPlaying ? t('track.pause') : t('playlist.playAll')}
      </button>

      <button
        type="button"
        onClick={onShuffle}
        title={t('playlist.shuffle')}
        className="inline-flex items-center gap-1.5 px-3.5 h-11 rounded-2xl text-[12.5px] font-semibold border bg-ink/[0.04] border-ink/[0.07] text-ink-65 hover:bg-ink/[0.07] hover:text-ink-90 hover:border-ink/[0.12] transition-colors duration-200 cursor-pointer"
      >
        <Shuffle size={14} />
        <span className="hidden @min-[384px]:inline">{t('playlist.shuffle')}</span>
      </button>

      <PlaylistLikeBtn
        playlistUrn={playlist.urn}
        playlist={playlist}
        count={playlist.likes_count}
      />

      <div className="flex h-11 items-center gap-0.5 rounded-2xl border border-ink/[0.07] bg-ink/[0.04] px-1.5">
        <button
          type="button"
          onClick={onTogglePin}
          title={isPinned ? t('sidebar.unpinPlaylist') : t('sidebar.pinPlaylist')}
          aria-label={isPinned ? t('sidebar.unpinPlaylist') : t('sidebar.pinPlaylist')}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 cursor-pointer ${
            isPinned
              ? 'text-accent bg-accent/15'
              : 'text-ink-60 hover:text-ink-95 hover:bg-ink/[0.07]'
          }`}
        >
          <MapPin size={16} />
        </button>
        <CopyIconAction url={playlist.permalink_url} />
        <ShareButton
          embed={shareEmbed}
          size={16}
          className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-60 hover:text-ink-95 hover:bg-ink/[0.07] transition-colors duration-200 cursor-pointer"
        />
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
            <span className="w-px h-5 bg-ink/[0.08] mx-0.5" aria-hidden />
            <button
              type="button"
              onClick={onEdit}
              title={t('playlist.edit')}
              aria-label={t('playlist.edit')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-55 hover:text-ink-95 hover:bg-ink/[0.07] transition-colors duration-200 cursor-pointer"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={onChangeCover}
              title={t('playlist.cover.change')}
              aria-label={t('playlist.cover.change')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-55 hover:text-ink-95 hover:bg-ink/[0.07] transition-colors duration-200 cursor-pointer"
            >
              <ImagePlus size={15} />
            </button>
            <ArrangeMenu disabled={!canArrange} onArrange={onArrange} />
            <button
              type="button"
              disabled={!canArrange}
              onClick={() => setDupesOpen(true)}
              title={dupesLabel}
              aria-label={dupesLabel}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-55 hover:text-ink-95 hover:bg-ink/[0.07] transition-colors duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Copy size={15} />
            </button>
            <DuplicatesDialog
              open={dupesOpen}
              onOpenChange={setDupesOpen}
              tracks={tracks}
              onRemove={onRemoveDuplicates}
            />
            <SharingToggle kind="playlist" urn={playlist.urn} sharing={playlist.sharing} />
            <button
              type="button"
              onClick={onDelete}
              title={t('playlist.delete')}
              aria-label={t('playlist.delete')}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-55 hover:text-bad hover:bg-bad/10 transition-colors duration-200 cursor-pointer"
            >
              <Trash2 size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
});
