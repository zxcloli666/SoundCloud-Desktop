import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AddToPlaylistDialog } from '../components/music/AddToPlaylistDialog';
import { LikeButton } from '../components/music/LikeButton';
import { PlaylistCard } from '../components/music/PlaylistCard';
import { VirtualList } from '../components/ui/VirtualList';
import { api } from '../lib/api';
import { preloadTrack } from '../lib/audio';
import { art, dur, fc } from '../lib/formatters';
import {
  type SCUser,
  useInfiniteScroll,
  useSearchPlaylists,
  useSearchTracks,
  useSearchUsers,
} from '../lib/hooks';
import {
  ExternalLink,
  headphones11,
  heart11,
  ListPlus,
  Loader2,
  musicIcon20,
  Pause,
  Play,
  Search as SearchIcon,
  Users,
  X,
} from '../lib/icons';
import { useTrackPlay } from '../lib/useTrackPlay';
import type { Track } from '../stores/player';

/* ── Components ───────────────────────────────────────────── */

const TrackRow = React.memo(
  function TrackRow({ track, queue }: { track: Track; queue: Track[] }) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isThis, isThisPlaying, togglePlay } = useTrackPlay(track, queue);
    const cover = art(track.artwork_url, 't200x200');

    return (
      <div
        className={`group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 ease-[var(--ease-apple)] ${
          isThis
            ? 'bg-accent/[0.06] ring-1 ring-accent/20 shadow-[inset_0_0_20px_rgba(255,85,0,0.05)]'
            : 'hover:bg-white/[0.04]'
        }`}
        onMouseEnter={() => preloadTrack(track.urn)}
      >
        <div
          className="w-10 h-10 flex items-center justify-center shrink-0 cursor-pointer"
          onClick={togglePlay}
        >
          {isThisPlaying ? (
            <div className="w-9 h-9 rounded-full bg-accent text-accent-contrast flex items-center justify-center shadow-[0_0_15px_var(--color-accent-glow)] scale-100 animate-fade-in-up">
              <Pause size={16} fill="currentColor" strokeWidth={0} />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-full bg-white/[0.06] group-hover:bg-white/10 flex items-center justify-center transition-all">
              <Play
                size={16}
                fill="white"
                strokeWidth={0}
                className="ml-0.5 opacity-60 group-hover:opacity-100"
              />
            </div>
          )}
        </div>

        <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] shadow-md">
          {cover ? (
            <img src={cover} alt="" className="w-full h-full object-cover" decoding="async" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.05] to-transparent">
              {musicIcon20}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p
            className={`text-[14px] font-medium truncate cursor-pointer transition-colors duration-200 ${
              isThis
                ? 'text-accent drop-shadow-[0_0_8px_rgba(255,85,0,0.4)]'
                : 'text-white/90 hover:text-white'
            }`}
            onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
          >
            {track.title}
          </p>
          <p
            className="text-[12px] text-white/40 truncate mt-0.5 cursor-pointer hover:text-white/70 transition-colors"
            onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
          >
            {track.user.username}
          </p>
        </div>

        <div className="hidden md:flex items-center gap-4 shrink-0 pr-4">
          {track.playback_count != null && (
            <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-16">
              {headphones11}
              {fc(track.playback_count)}
            </span>
          )}
          <span className="text-[11px] text-white/30 tabular-nums flex items-center gap-1.5 w-14">
            {heart11}
            {fc(track.favoritings_count ?? track.likes_count)}
          </span>
        </div>

        {/* Like + Add to playlist */}
        <div className="flex items-center gap-0.5 shrink-0">
          <LikeButton track={track} />
          <AddToPlaylistDialog trackUrns={[track.urn]}>
            <button
              type="button"
              className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-white/20 hover:text-white/50 opacity-0 group-hover:opacity-100 transition-all duration-200"
              title={t('playlist.addToPlaylist')}
            >
              <ListPlus size={14} />
            </button>
          </AddToPlaylistDialog>
        </div>

        <span className="text-[12px] text-white/30 tabular-nums font-medium shrink-0 w-12 text-right">
          {dur(track.duration)}
        </span>
      </div>
    );
  },
  (prev, next) =>
    prev.track.urn === next.track.urn && prev.track.user_favorite === next.track.user_favorite,
);

const UserCard = React.memo(({ user }: { user: SCUser }) => {
  const navigate = useNavigate();
  const avatar = art(user.avatar_url, 't300x300');

  return (
    <div
      className="group flex flex-col items-center gap-4 p-5 rounded-3xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.08] transition-all duration-300 cursor-pointer"
      onClick={() => navigate(`/user/${encodeURIComponent(user.urn)}`)}
    >
      <div className="relative w-24 h-24 rounded-full shadow-xl overflow-hidden ring-2 ring-white/[0.05] group-hover:ring-white/[0.15] group-hover:scale-105 transition-all duration-500">
        {avatar ? (
          <img
            src={avatar}
            alt={user.username}
            className="w-full h-full object-cover"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-white/5 flex items-center justify-center">
            <Users size={32} className="text-white/20" />
          </div>
        )}
      </div>

      <div className="text-center w-full">
        <p className="text-[15px] font-bold text-white/90 truncate group-hover:text-white transition-colors">
          {user.username}
        </p>
        <div className="flex items-center justify-center gap-3 mt-2 text-[11px] text-white/30 font-medium">
          <span className="uppercase tracking-wider flex items-center gap-1">
            <Users size={10} />
            {fc(user.followers_count)}
          </span>
        </div>
      </div>
    </div>
  );
});

/* ── URL Detection ───────────────────────────────────────── */

const SC_URL_RE = /^https?:\/\/(www\.|m\.|on\.)?soundcloud\.com\/.+/i;

function isSoundCloudUrl(input: string): boolean {
  return SC_URL_RE.test(input.trim());
}

/* ── Resolve Card ────────────────────────────────────────── */

function ResolveCard({ url, onDone }: { url: string; onDone: () => void }) {
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'error' | 'success'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    api<{ kind: string; urn: string }>(`/resolve?url=${encodeURIComponent(url.trim())}`)
      .then((res) => {
        if (cancelled) return;
        setState('success');
        const kind = res.kind;
        const urn = res.urn;
        if (kind === 'track') {
          navigate(`/track/${encodeURIComponent(urn)}`);
        } else if (kind === 'playlist' || kind === 'system-playlist') {
          navigate(`/playlist/${encodeURIComponent(urn)}`);
        } else if (kind === 'user') {
          navigate(`/user/${encodeURIComponent(urn)}`);
        } else {
          setErrorMsg(`Unknown resource: ${kind}`);
          setState('error');
        }
        onDone();
      })
      .catch((e) => {
        if (cancelled) return;
        setErrorMsg(e?.body ? 'Link not found' : 'Failed to resolve');
        setState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [url, navigate, onDone]);

  return (
    <div className="max-w-lg mx-auto mt-12 animate-fade-in-up">
      <div className="glass rounded-3xl p-6 border border-white/[0.06]">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center shrink-0">
            <ExternalLink size={20} className="text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/80">
              {state === 'loading'
                ? 'Resolving link...'
                : state === 'error'
                  ? 'Could not resolve'
                  : 'Redirecting...'}
            </p>
            <p className="text-[11px] text-white/30 truncate mt-0.5">{url.trim()}</p>
          </div>
          {state === 'loading' && (
            <Loader2 size={20} className="text-accent animate-spin shrink-0" />
          )}
        </div>
        {state === 'error' && <p className="text-[12px] text-red-400/70 mt-3 pl-16">{errorMsg}</p>}
      </div>
    </div>
  );
}

/* ── Isolated Search Results ──────────────────────────────── */

/* Each search tab is its own component — only fetches its own data type */

const SearchTracksTab = React.memo(function SearchTracksTab({ query }: { query: string }) {
  const { t } = useTranslation();
  const tracksQuery = useSearchTracks(query);
  const sentinelRef = useInfiniteScroll(
    !!tracksQuery.hasNextPage,
    !!tracksQuery.isFetchingNextPage,
    tracksQuery.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {tracksQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-white/20" />
        </div>
      ) : tracksQuery.tracks.length === 0 ? (
        <div className="py-20 text-center text-white/30">{t('search.noResults')}</div>
      ) : (
        <VirtualList
          items={tracksQuery.tracks}
          rowHeight={68}
          overscan={8}
          className="flex flex-col gap-1"
          disabled={tracksQuery.tracks.length < 40}
          getItemKey={(track) => track.urn}
          renderItem={(track) => <TrackRow track={track} queue={tracksQuery.tracks} />}
        />
      )}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center mt-6">
        {tracksQuery.isFetchingNextPage && (
          <Loader2 size={24} className="text-white/20 animate-spin" />
        )}
      </div>
    </div>
  );
});

const SearchPlaylistsTab = React.memo(function SearchPlaylistsTab({ query }: { query: string }) {
  const { t } = useTranslation();
  const playlistsQuery = useSearchPlaylists(query);
  const sentinelRef = useInfiniteScroll(
    !!playlistsQuery.hasNextPage,
    !!playlistsQuery.isFetchingNextPage,
    playlistsQuery.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {playlistsQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-white/20" />
        </div>
      ) : playlistsQuery.playlists.length === 0 ? (
        <div className="py-20 text-center text-white/30">{t('search.noResults')}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {playlistsQuery.playlists.map((p, i) => (
            <PlaylistCard key={`${p.urn}-${i}`} playlist={p} />
          ))}
        </div>
      )}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center mt-6">
        {playlistsQuery.isFetchingNextPage && (
          <Loader2 size={24} className="text-white/20 animate-spin" />
        )}
      </div>
    </div>
  );
});

const SearchUsersTab = React.memo(function SearchUsersTab({ query }: { query: string }) {
  const { t } = useTranslation();
  const usersQuery = useSearchUsers(query);
  const sentinelRef = useInfiniteScroll(
    !!usersQuery.hasNextPage,
    !!usersQuery.isFetchingNextPage,
    usersQuery.fetchNextPage,
  );

  return (
    <div className="min-h-[400px]">
      {usersQuery.isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 size={32} className="animate-spin text-white/20" />
        </div>
      ) : usersQuery.users.length === 0 ? (
        <div className="py-20 text-center text-white/30">{t('search.noResults')}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {usersQuery.users.map((u, i) => (
            <UserCard key={`${u.urn}-${i}`} user={u} />
          ))}
        </div>
      )}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center mt-6">
        {usersQuery.isFetchingNextPage && (
          <Loader2 size={24} className="text-white/20 animate-spin" />
        )}
      </div>
    </div>
  );
});

const SearchEmpty = React.memo(function SearchEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] text-white/20">
      <SearchIcon size={48} className="mb-4 opacity-50" />
      <p className="text-sm font-medium">Search for artists, bands, tracks, podcasts</p>
    </div>
  );
});

/* ── Search Page ──────────────────────────────────────────── */

export const Search = React.memo(() => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists' | 'users'>('tracks');
  const [resolveUrl, setResolveUrl] = useState<string | null>(null);

  const isUrl = isSoundCloudUrl(inputValue);

  // Debounce logic — skip debounce for URLs
  useEffect(() => {
    if (isUrl) {
      setDebouncedQuery('');
      return;
    }
    setResolveUrl(null);
    const handler = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [inputValue, isUrl]);

  // Handle Enter for URL resolve
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isUrl) {
      setResolveUrl(inputValue.trim());
    }
  };

  // Handle paste — auto-resolve if it's a SC URL
  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text');
    if (isSoundCloudUrl(pasted)) {
      e.preventDefault();
      setInputValue(pasted);
      setResolveUrl(pasted.trim());
    }
  };

  const tabs = [
    { id: 'tracks', label: t('search.tracks') },
    { id: 'playlists', label: t('search.playlists') },
    { id: 'users', label: t('search.users') },
  ] as const;

  return (
    <div className="p-6 pb-4 space-y-8">
      {/* Search Input */}
      <div className="relative max-w-2xl mx-auto">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          {isUrl ? (
            <ExternalLink size={20} className="text-accent" />
          ) : (
            <SearchIcon size={20} className="text-white/40" />
          )}
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t('search.placeholder')}
          className={`w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] text-white placeholder:text-white/30 text-[16px] py-4 pl-12 pr-12 rounded-[20px] outline-none border transition-all duration-300 shadow-xl backdrop-blur-md ${
            isUrl
              ? 'border-accent/30 ring-1 ring-accent/20'
              : 'border-white/[0.05] focus:border-accent/30 focus:ring-1 focus:ring-accent/30'
          }`}
          autoFocus
        />
        {inputValue && (
          <button
            onClick={() => {
              setInputValue('');
              setResolveUrl(null);
            }}
            className="absolute inset-y-0 right-4 flex items-center text-white/30 hover:text-white cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        )}
        {isUrl && !resolveUrl && (
          <div className="absolute -bottom-7 left-0 text-[11px] text-accent/60 flex items-center gap-1.5">
            <ExternalLink size={10} />
            Press Enter to open link
          </div>
        )}
      </div>

      {/* Tabs */}
      {debouncedQuery && (
        <div className="flex items-center justify-center gap-1.5 p-1.5 bg-white/[0.02] border border-white/[0.05] rounded-2xl w-fit backdrop-blur-2xl shadow-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ease-[var(--ease-apple)] ${
                  isActive
                    ? 'bg-white/[0.12] text-white shadow-md border border-white/[0.05]'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Resolve */}
      {resolveUrl && (
        <ResolveCard
          url={resolveUrl}
          onDone={() => {
            setInputValue('');
            setResolveUrl(null);
          }}
        />
      )}

      {/* Results — each tab only fetches its own data */}
      {!resolveUrl && !debouncedQuery && <SearchEmpty />}
      {!resolveUrl && debouncedQuery && activeTab === 'tracks' && (
        <SearchTracksTab query={debouncedQuery} />
      )}
      {!resolveUrl && debouncedQuery && activeTab === 'playlists' && (
        <SearchPlaylistsTab query={debouncedQuery} />
      )}
      {!resolveUrl && debouncedQuery && activeTab === 'users' && (
        <SearchUsersTab query={debouncedQuery} />
      )}
    </div>
  );
});
