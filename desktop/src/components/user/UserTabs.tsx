import { CloudOff, RefreshCw } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Aura } from '../../lib/aura';
import { fc } from '../../lib/formatters';
import {
  useInfiniteScroll,
  useUserFollowers,
  useUserFollowings,
  useUserLikedTracks,
  useUserPlaylists,
  useUserPopularTracks,
  useUserTracks,
} from '../../lib/hooks';
import { Loader2, Music } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import { useCatalogPlaylists, useCatalogTracks } from '../../lib/search';
import { PlaylistCard } from '../music/PlaylistCard';
import { SearchState } from '../search/SearchState';
import { Avatar } from '../ui/Avatar';
import { VirtualGrid } from '../ui/VirtualGrid';
import { VirtualList } from '../ui/VirtualList';
import { ThemedTrackRow } from './ThemedTrackRow';

interface TabWrapperProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText?: string;
  isError?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}

function TabWrapperImpl({
  children,
  isLoading,
  isEmpty,
  emptyText,
  isError,
  onRetry,
}: TabWrapperProps) {
  const { t } = useTranslation();
  return (
    <div className="min-h-[420px]">
      {isLoading ? (
        <div className="py-24 flex justify-center">
          <Loader2 size={28} className="text-white/20 animate-spin" />
        </div>
      ) : isEmpty && isError && onRetry ? (
        <SearchState
          icon={<CloudOff size={26} />}
          title={t('user.search.error')}
          cta={t('search.error.retry')}
          ctaIcon={<RefreshCw size={15} />}
          onAction={onRetry}
        />
      ) : isEmpty ? (
        <div className="py-24 flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '0.5px solid rgba(255,255,255,0.06)',
            }}
          >
            <Music size={24} className="text-white/15" />
          </div>
          <p className="text-white/30 text-sm">{emptyText ?? t('common.empty')}</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">{children}</div>
      )}
    </div>
  );
}

export const TabWrapper = React.memo(TabWrapperImpl);

export function UserTracksTab({ urn, aura }: { urn: string; aura: Aura }) {
  const q = useUserTracks(urn);
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);
  const renderItem = useCallback(
    (track: (typeof q.tracks)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={q.tracks} aura={aura} />
    ),
    [aura, q.tracks],
  );
  return (
    <TabWrapper isLoading={q.isLoading} isEmpty={q.tracks.length === 0}>
      <VirtualList
        items={q.tracks}
        rowHeight={72}
        overscan={8}
        className="flex flex-col gap-1"
        getItemKey={(t) => t.urn}
        renderItem={renderItem}
      />
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-white/20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

export function UserPopularTab({ urn, aura }: { urn: string; aura: Aura }) {
  const { data = [], isLoading } = useUserPopularTracks(urn);
  const renderItem = useCallback(
    (track: (typeof data)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={data} aura={aura} />
    ),
    [aura, data],
  );
  return (
    <TabWrapper isLoading={isLoading} isEmpty={data.length === 0}>
      <VirtualList
        items={data}
        rowHeight={72}
        overscan={8}
        className="flex flex-col gap-1"
        getItemKey={(t) => t.urn}
        renderItem={renderItem}
      />
    </TabWrapper>
  );
}

export function UserPlaylistsTab({ urn }: { urn: string }) {
  const q = useUserPlaylists(urn);
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);
  const renderItem = useCallback(
    (p: (typeof q.playlists)[number]) => <PlaylistCard playlist={p} showPlayback />,
    [],
  );
  return (
    <TabWrapper isLoading={q.isLoading} isEmpty={q.playlists.length === 0}>
      <VirtualGrid
        items={q.playlists}
        itemHeight={320}
        minColumnWidth={200}
        gap={28}
        overscan={3}
        getItemKey={(p, i) => `${p.urn}-${i}`}
        renderItem={renderItem}
      />
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-white/20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

export function UserLikesTab({ urn, aura }: { urn: string; aura: Aura }) {
  const q = useUserLikedTracks(urn);
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);
  const renderItem = useCallback(
    (track: (typeof q.tracks)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={q.tracks} aura={aura} />
    ),
    [aura, q.tracks],
  );
  return (
    <TabWrapper isLoading={q.isLoading} isEmpty={q.tracks.length === 0}>
      <VirtualList
        items={q.tracks}
        rowHeight={72}
        overscan={8}
        className="flex flex-col gap-1"
        getItemKey={(t) => t.urn}
        renderItem={renderItem}
      />
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-white/20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

/**
 * Поиск треков юзера в нашей базе (`/search/db/tracks?user_urn=...`). Идёт
 * только локально — на SC нет API "tracks этого юзера с подстрочным q=".
 * Рендер совместим с обычным UserTracksTab, чтобы UI не "прыгал" при
 * включении/выключении поиска.
 */
export function UserSearchTracksTab({
  urn,
  aura,
  query,
}: {
  urn: string;
  aura: Aura;
  query: string;
}) {
  const { t } = useTranslation();
  const q = useCatalogTracks(query.trim(), urn);
  const ref = useInfiniteScroll(
    !!q.hasNextPage && !q.isFetchNextPageError,
    !!q.isFetchingNextPage,
    q.fetchNextPage,
  );
  const renderItem = useCallback(
    (track: (typeof q.items)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={q.items} aura={aura} />
    ),
    [aura, q.items],
  );
  return (
    <TabWrapper
      isLoading={q.isLoading}
      isEmpty={q.items.length === 0}
      emptyText={t('user.search.empty')}
      isError={q.isError}
      onRetry={() => void q.refetch()}
    >
      <VirtualList
        items={q.items}
        rowHeight={72}
        overscan={8}
        className="flex flex-col gap-1"
        getItemKey={(t) => t.urn}
        renderItem={renderItem}
      />
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-white/20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

/**
 * Поиск плейлистов юзера в нашей базе. Та же логика, что и Tracks-вариант.
 */
export function UserSearchPlaylistsTab({ urn, query }: { urn: string; query: string }) {
  const { t } = useTranslation();
  const q = useCatalogPlaylists(query.trim(), urn);
  const ref = useInfiniteScroll(
    !!q.hasNextPage && !q.isFetchNextPageError,
    !!q.isFetchingNextPage,
    q.fetchNextPage,
  );
  const renderItem = useCallback(
    (p: (typeof q.items)[number]) => <PlaylistCard playlist={p} showPlayback />,
    [],
  );
  return (
    <TabWrapper
      isLoading={q.isLoading}
      isEmpty={q.items.length === 0}
      emptyText={t('user.search.empty')}
      isError={q.isError}
      onRetry={() => void q.refetch()}
    >
      <VirtualGrid
        items={q.items}
        itemHeight={320}
        minColumnWidth={200}
        gap={28}
        overscan={3}
        getItemKey={(p, i) => `${p.urn}-${i}`}
        renderItem={renderItem}
      />
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-white/20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

export function UserConnectionsTab({
  urn,
  mode,
}: {
  urn: string;
  mode: 'followers' | 'followings';
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
    const cardB = usePerfMode().blur(20);
  const followers = useUserFollowers(mode === 'followers' ? urn : undefined);
  const followings = useUserFollowings(mode === 'followings' ? urn : undefined);
  const q = mode === 'followers' ? followers : followings;
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);

  const renderItem = useCallback(
    (user: (typeof q.users)[number]) => (
      <button
        type="button"
        onClick={() => nav(`/user/${encodeURIComponent(user.urn)}`)}
        className="group relative h-full w-full flex flex-col items-center gap-3 p-6 rounded-3xl transition-transform duration-500 cursor-pointer overflow-hidden hover:scale-[1.02]"
        style={{
            background: cardB > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(24,24,28,0.85)',
          border: '0.5px solid rgba(255,255,255,0.06)',
            backdropFilter: cardB > 0 ? `blur(${cardB}px)` : undefined,
            WebkitBackdropFilter: cardB > 0 ? `blur(${cardB}px)` : undefined,
        }}
      >
        <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10 group-hover:ring-white/30 transition-all duration-500">
          <Avatar src={user.avatar_url} alt={user.username} size={80} />
        </div>
        <div className="text-center min-w-0 w-full">
          <p className="text-[13px] font-semibold text-white/90 truncate group-hover:text-white">
            {user.username}
          </p>
          {user.followers_count != null && (
            <p className="text-[10px] text-white/30 mt-1 tabular-nums uppercase tracking-widest font-semibold">
              {fc(user.followers_count)} {t('user.followers')}
            </p>
          )}
        </div>
      </button>
    ),
      [nav, t, cardB],
  );

  const emptyText = mode === 'followers' ? t('user.noFollowers') : t('user.noFollowings');

  return (
    <TabWrapper isLoading={q.isLoading} isEmpty={q.users.length === 0} emptyText={emptyText}>
      <VirtualGrid
        items={q.users}
        itemHeight={220}
        minColumnWidth={200}
        gap={20}
        overscan={3}
        getItemKey={(u) => u.urn}
        renderItem={renderItem}
      />
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-white/20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}
