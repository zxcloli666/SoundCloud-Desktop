import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { AddToPlaylistDialog } from '../components/music/AddToPlaylistDialog';
import { CopyLinkButton } from '../components/ui/CopyLinkButton';
import { api } from '../lib/api';
import { getCurrentTime, preloadTrack } from '../lib/audio';
import { downloadTrack } from '../lib/cache';
import { ago, art, dateFormatted, dur, durLong, fc } from '../lib/formatters';
import {
  type Comment,
  invalidateAllLikesCache,
  useInfiniteScroll,
  usePostComment,
  useRelatedTracks,
  useTrackComments,
  useTrackFavoriters,
} from '../lib/hooks';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Hash,
  Headphones,
  Heart,
  ListPlus,
  Loader2,
  MessageCircle,
  Music,
  musicIcon14,
  pauseBlack11,
  pauseBlack22,
  pauseCurrent16,
  playBlack11,
  playBlack22,
  playCurrent16,
  Repeat2,
  Send,
} from '../lib/icons';
import { optimisticToggleLike, setLikedUrn, useLiked } from '../lib/likes';
import { useTrackPlay } from '../lib/useTrackPlay';
import { useLyricsStore } from '../stores/lyrics';
import { type Track, usePlayerStore } from '../stores/player';

function parseTags(tagList?: string): string[] {
  if (!tagList) return [];
  const tags: string[] = [];
  const re = /"([^"]+)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tagList))) {
    tags.push(m[1] || m[2]);
  }
  return tags;
}

/* ── Like Button ─────────────────────────────────────────── */

const LikeBtn = React.memo(({ trackUrn, count }: { trackUrn: string; count?: number }) => {
  const liked = useLiked(trackUrn);
  const [localCount, setLocalCount] = useState(count ?? 0);
  const qc = useQueryClient();

  useEffect(() => {
    setLocalCount(count ?? 0);
  }, [count]);

  const toggle = async () => {
    const next = !liked;
    setLocalCount((c) => c + (next ? 1 : -1));
    const cachedTrack = qc.getQueryData<Track>(['track', trackUrn]);
    if (cachedTrack) optimisticToggleLike(qc, cachedTrack, next);
    else setLikedUrn(trackUrn, next);
    invalidateAllLikesCache();
    try {
      await api(`/likes/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
      qc.invalidateQueries({ queryKey: ['track', trackUrn, 'favoriters'] });
    } catch {
      setLocalCount((c) => c + (next ? -1 : 1));
      if (cachedTrack) optimisticToggleLike(qc, cachedTrack, !next);
      else setLikedUrn(trackUrn, !next);
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
});

/* ── Repost Button ───────────────────────────────────────── */

const RepostBtn = React.memo(({ trackUrn, count }: { trackUrn: string; count?: number }) => {
  const [reposted, setReposted] = useState(false);
  const [localCount, setLocalCount] = useState(count ?? 0);

  const toggle = async () => {
    const next = !reposted;
    setReposted(next);
    setLocalCount((c) => c + (next ? 1 : -1));
    try {
      await api(`/reposts/tracks/${encodeURIComponent(trackUrn)}`, {
        method: next ? 'POST' : 'DELETE',
      });
    } catch {
      setReposted(!next);
      setLocalCount((c) => c + (next ? -1 : 1));
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer ${
        reposted
          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
          : 'glass hover:bg-white/[0.05] text-white/60 hover:text-white/80'
      }`}
    >
      <Repeat2 size={16} />
      <span className="tabular-nums">{fc(localCount)}</span>
    </button>
  );
});

/* ── Comment Item ────────────────────────────────────────── */

const CommentItem = React.memo(({ comment }: { comment: Comment }) => {
  const navigate = useNavigate();
  const avatar = art(comment.user.avatar_url, 'small');

  return (
    <div className="flex gap-3 group">
      <img
        src={avatar ?? ''}
        alt=""
        className="w-8 h-8 rounded-full shrink-0 ring-1 ring-white/[0.06] mt-0.5 cursor-pointer hover:ring-white/[0.15] transition-all duration-150"
        onClick={() => navigate(`/user/${encodeURIComponent(comment.user.urn)}`)}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-[12px] font-medium text-white/70 hover:text-white/90 cursor-pointer transition-colors duration-150"
            onClick={() => navigate(`/user/${encodeURIComponent(comment.user.urn)}`)}
          >
            {comment.user.username}
          </span>
          {comment.timestamp != null && (
            <span className="text-[10px] text-white/20 tabular-nums flex items-center gap-0.5">
              <Clock size={9} />
              {durLong(comment.timestamp)}
            </span>
          )}
          <span className="text-[10px] text-white/15 ml-auto shrink-0">
            {ago(comment.created_at)}
          </span>
        </div>
        <p className="text-[13px] text-white/55 mt-0.5 leading-relaxed break-words">
          {comment.body}
        </p>
      </div>
    </div>
  );
});

/* ── Comment Form ────────────────────────────────────────── */

const CommentForm = React.memo(({ trackUrn }: { trackUrn: string }) => {
  const { t } = useTranslation();
  const [body, setBody] = useState('');
  const mutation = usePostComment(trackUrn);

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    const time = getCurrentTime();
    const ts = time > 0 ? Math.floor(time * 1000) : undefined;
    mutation.mutate({ body: text, timestamp: ts });
    setBody('');
  };

  return (
    <div className="flex gap-3 glass rounded-xl px-4 py-3">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t('track.addComment')}
        rows={2}
        className="flex-1 bg-transparent text-[13px] text-white/80 placeholder:text-white/20 outline-none resize-none leading-relaxed"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!body.trim() || mutation.isPending}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-accent hover:bg-accent/10 transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-default self-end"
      >
        {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
    </div>
  );
});

/* ── Related Track Row ───────────────────────────────────── */

const RelatedRow = React.memo(
  ({ track, queue }: { track: Track; queue: Track[] }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const cover = art(track.artwork_url, 't200x200');

    const handleAddToQueue = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      usePlayerStore.getState().addToQueueNext([track]);
    }, [track]);

    return (
      <div
        className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200 ease-[var(--ease-apple)] ${
          isThis ? 'bg-accent/[0.04] ring-1 ring-accent/15' : 'hover:bg-white/[0.03]'
        }`}
        onMouseEnter={() => preloadTrack(track.urn)}
      >
        <div
          className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 ring-1 ring-white/[0.06] cursor-pointer"
          onClick={togglePlay}
        >
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/[0.03]">
              {musicIcon14}
            </div>
          )}
          <div
            className={`absolute inset-0 flex items-center justify-center transition-all duration-200 ${
              isThisPlaying
                ? 'bg-black/30 opacity-100'
                : 'opacity-0 group-hover:bg-black/30 group-hover:opacity-100'
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-lg">
              {isThisPlaying ? pauseBlack11 : playBlack11}
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p
            className="text-[12px] font-medium text-white/85 truncate cursor-pointer hover:text-white transition-colors duration-150"
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

        <div className="text-right shrink-0">
          <p className="text-[10px] text-white/25 tabular-nums">{dur(track.duration)}</p>
          {track.playback_count != null && (
            <p className="text-[9px] text-white/15 mt-0.5 tabular-nums flex items-center gap-0.5 justify-end">
              <Headphones size={8} />
              {fc(track.playback_count)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleAddToQueue}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white/80 hover:bg-white/[0.08] transition-all duration-200 shrink-0"
          title={t('player.addToQueue')}
        >
          <ListPlus size={14} />
        </button>
      </div>
    );
  },
  (prev, next) => prev.track.urn === next.track.urn,
);

/* ── Download Button ─────────────────────────────────────── */

const DownloadButton = React.memo(({ track }: { track: Track }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await downloadTrack(track.urn, track.user.username, track.title);
      toast.success(t('track.downloaded'));
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'cancelled') return;
      console.error('Download failed:', e);
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium glass hover:bg-white/[0.05] text-white/60 hover:text-white/80 transition-all duration-200 cursor-pointer disabled:opacity-50"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
      {t('track.download')}
    </button>
  );
});

/* ── Main: TrackPage ─────────────────────────────────────── */

export const TrackPage = React.memo(() => {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [descExpanded, setDescExpanded] = useState(false);
  const openLyrics = useLyricsStore((s) => s.openPanel);

  const { data: track, isLoading } = useQuery({
    queryKey: ['track', urn],
    queryFn: () => api<Track>(`/tracks/${encodeURIComponent(urn!)}`),
    enabled: !!urn,
    staleTime: 30_000,
  });

  const {
    comments,
    fetchNextPage: fetchMoreComments,
    hasNextPage: hasMoreComments,
    isFetchingNextPage: fetchingMoreComments,
    isLoading: commentsLoading,
  } = useTrackComments(urn);

  const commentsSentinel = useInfiniteScroll(
    hasMoreComments,
    fetchingMoreComments,
    fetchMoreComments,
  );

  const { data: relatedData, isLoading: relatedLoading } = useRelatedTracks(urn, 10);
  const { data: favoritersData } = useTrackFavoriters(urn, 12);

  const trackUrn = track?.urn;

  // Seed liked status from API
  useEffect(() => {
    if (track?.user_favorite && track.urn) setLikedUrn(track.urn, true);
  }, [track?.urn, track?.user_favorite]);

  const isThis = usePlayerStore((s) => !!trackUrn && s.currentTrack?.urn === trackUrn);
  const isThisPlaying = usePlayerStore(
    (s) => !!trackUrn && s.currentTrack?.urn === trackUrn && s.isPlaying,
  );

  const relatedTracks = useMemo(() => relatedData?.collection ?? [], [relatedData]);
  const favoriters = useMemo(() => favoritersData?.collection ?? [], [favoritersData]);

  if (isLoading || !track) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={24} className="text-white/15 animate-spin" />
      </div>
    );
  }

  const cover = art(track.artwork_url, 't500x500');
  const tags = parseTags(track.tag_list);
  const desc = track.description?.trim();
  const descLong = desc && desc.length > 200;

  const handlePlay = () => {
    const { play, pause, resume } = usePlayerStore.getState();
    if (isThisPlaying) pause();
    else if (isThis) resume();
    else play(track, relatedTracks.length > 0 ? [track, ...relatedTracks] : undefined);
  };

  return (
    <div className="p-6 pb-4 space-y-7">
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
            onClick={handlePlay}
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
                isThisPlaying
                  ? 'bg-black/30 opacity-100'
                  : 'bg-black/0 opacity-0 group-hover/cover:bg-black/30 group-hover/cover:opacity-100'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ease-[var(--ease-apple)] ${
                  isThisPlaying
                    ? 'bg-white scale-100'
                    : 'bg-white/90 scale-75 group-hover/cover:scale-100'
                }`}
              >
                {isThisPlaying ? pauseBlack22 : playBlack22}
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
              onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
            >
              {track.user.avatar_url && (
                <img
                  src={art(track.user.avatar_url, 'small') ?? ''}
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
                onClick={handlePlay}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer shadow-[0_0_20px_var(--color-accent-glow)] ${
                  isThisPlaying
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'bg-accent text-accent-contrast hover:bg-accent-hover active:scale-[0.97]'
                }`}
              >
                {isThisPlaying ? pauseCurrent16 : playCurrent16}
                {isThisPlaying ? 'Pause' : 'Play'}
              </button>

              <LikeBtn trackUrn={track.urn} count={track.favoritings_count ?? track.likes_count} />
              <RepostBtn trackUrn={track.urn} count={track.reposts_count} />
              <button
                type="button"
                onClick={() => openLyrics('lyrics')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium glass hover:bg-white/[0.05] text-white/60 hover:text-white/80 transition-all duration-200 cursor-pointer"
              >
                <Music size={16} />
                {t('track.lyrics')}
              </button>
              <AddToPlaylistDialog trackUrns={[track.urn]}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium glass hover:bg-white/[0.05] text-white/60 hover:text-white/80 transition-all duration-200 cursor-pointer"
                >
                  <ListPlus size={16} />
                  {t('playlist.addToPlaylist')}
                </button>
              </AddToPlaylistDialog>
              <CopyLinkButton url={track.permalink_url} />
              <DownloadButton track={track} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────── */}
      <section className="flex items-center gap-5 px-1 flex-wrap">
        <div className="flex items-center gap-1.5 text-[12px] text-white/30">
          <Headphones size={13} className="text-white/20" />
          <span className="tabular-nums font-medium">{fc(track.playback_count)}</span>
          <span className="text-white/15">{t('track.plays')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/30">
          <Heart size={13} className="text-white/20" />
          <span className="tabular-nums font-medium">
            {fc(track.favoritings_count ?? track.likes_count)}
          </span>
          <span className="text-white/15">{t('track.likes')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/30">
          <Repeat2 size={13} className="text-white/20" />
          <span className="tabular-nums font-medium">{fc(track.reposts_count)}</span>
          <span className="text-white/15">{t('track.reposts')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/30">
          <MessageCircle size={13} className="text-white/20" />
          <span className="tabular-nums font-medium">{fc(track.comment_count)}</span>
          <span className="text-white/15">{t('track.comments')}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/25 ml-auto">
          <Clock size={12} />
          <span className="tabular-nums">{durLong(track.duration)}</span>
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
                  !descExpanded && descLong ? 'max-h-[120px] overflow-hidden relative' : ''
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
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="flex items-center gap-1 mt-2 text-[11px] text-white/30 hover:text-white/50 transition-colors cursor-pointer"
                >
                  {descExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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
                  ({fc(track.comment_count)})
                </span>
              )}
            </h3>

            <CommentForm trackUrn={track.urn} />

            {commentsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="text-white/15 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle size={28} className="text-white/10 mx-auto mb-2" />
                <p className="text-[12px] text-white/20">{t('track.noComments')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {comments.map((c) => (
                  <CommentItem key={c.id} comment={c} />
                ))}
                <div ref={commentsSentinel} className="h-4 flex items-center justify-center">
                  {fetchingMoreComments && (
                    <Loader2 size={14} className="text-white/15 animate-spin" />
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
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            <div className="flex items-center gap-3">
              <img
                src={art(track.user.avatar_url, 't200x200') ?? ''}
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
              {t('track.posted')} {dateFormatted(track.created_at ?? '')}
            </span>
          </section>

          {/* Favoriters */}
          {favoriters.length > 0 && (
            <section className="glass rounded-2xl p-4">
              <h3 className="text-[12px] font-semibold text-white/40 mb-3">
                {t('track.favoriters')}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {favoriters.map((u) => (
                  <img
                    key={u.urn}
                    src={art(u.avatar_url, 'small') ?? ''}
                    alt={u.username}
                    title={u.username}
                    className="w-8 h-8 rounded-full ring-1 ring-white/[0.06] hover:ring-white/[0.15] transition-all duration-150 cursor-pointer"
                    onClick={() => navigate(`/user/${encodeURIComponent(u.urn)}`)}
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
                <Loader2 size={16} className="text-white/15 animate-spin" />
              </div>
            ) : relatedTracks.length === 0 ? (
              <p className="text-[12px] text-white/20 px-1">No related tracks</p>
            ) : (
              <div className="space-y-1">
                {relatedTracks.map((rt) => (
                  <RelatedRow key={rt.urn} track={rt} queue={relatedTracks} />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
});
