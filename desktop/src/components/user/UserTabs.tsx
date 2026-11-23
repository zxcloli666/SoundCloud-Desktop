import { CloudOff, RefreshCw } from 'lucide-react';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
import { useCatalogPlaylists, useCatalogTracks } from '../../lib/search';
import { isWaitKind } from '../../lib/sync-wait';
import { useAuthStore } from '../../stores/auth';
import { TrackColumns } from '../music/columns/TrackColumns';
import { PlaylistCard } from '../music/PlaylistCard';
import { SearchState } from '../search/SearchState';
import type { WaitScope } from '../sync-wait/scope';
import { Avatar } from '../ui/Avatar';
import { type SyncedQuery, SyncNotice, syncNoticeOf } from '../ui/SyncNotice';
import { VirtualGrid } from '../ui/VirtualGrid';
import { VirtualList } from '../ui/VirtualList';
import { ThemedTrackRow } from './ThemedTrackRow';
import { useThemedShape } from './useThemedShape';

interface TabWrapperProps {
  isLoading: boolean;
  isEmpty: boolean;
  emptyText?: string;
  isError?: boolean;
  onRetry?: () => void;
  query?: SyncedQuery & { refetch: () => unknown };
  ownerUrn?: string;
  scope?: WaitScope;
  children: React.ReactNode;
}

function TabWrapperImpl({
  children,
  isLoading,
  isEmpty,
  emptyText,
  isError,
  onRetry,
  query,
  ownerUrn,
  scope,
}: TabWrapperProps) {
  const { t } = useTranslation();
  const ownedByMe = useAuthStore((s) => !!ownerUrn && s.user?.urn === ownerUrn);
  const notice = query ? syncNoticeOf(query) : null;
  return (
    <div className="min-h-[420px]">
      {isLoading ? (
        <div className="py-24 flex justify-center">
          <Loader2 size={28} className="text-ink-20 animate-spin" />
        </div>
      ) : isEmpty && notice && query ? (
        <div className={ownedByMe && isWaitKind(notice) ? 'py-8' : 'py-24'}>
          <SyncNotice
            kind={notice}
            info={query.syncInfo}
            ownedByMe={ownedByMe}
            scope={scope}
            onRetry={() => void query.refetch()}
          />
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
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-ink/[0.05] text-ink-35">
            <Music size={24} />
          </div>
          <p className="text-[13px] text-ink-45">{emptyText ?? t('common.empty')}</p>
        </div>
      ) : (
        <div className="animate-in fade-in duration-500">{children}</div>
      )}
    </div>
  );
}

export const TabWrapper = React.memo(TabWrapperImpl);

export function UserTracksTab({ urn }: { urn: string }) {
  const q = useUserTracks(urn);
  const shape = useThemedShape(urn);
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);
  const renderItem = useCallback(
    (track: (typeof q.tracks)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={q.tracks} />
    ),
    [q.tracks],
  );
  return (
    <TabWrapper isLoading={q.isLoading} isEmpty={q.tracks.length === 0} query={q} ownerUrn={urn}>
      <TrackColumns shape={shape}>
        <VirtualList
          items={q.tracks}
          rowHeight={72}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(t) => t.urn}
          renderItem={renderItem}
        />
      </TrackColumns>
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-ink-20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

export function UserPopularTab({ urn }: { urn: string }) {
  const popular = useUserPopularTracks(urn);
  const shape = useThemedShape(urn);
  const { tracks, isLoading } = popular;
  const renderItem = useCallback(
    (track: (typeof tracks)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={tracks} />
    ),
    [tracks],
  );
  return (
    <TabWrapper isLoading={isLoading} isEmpty={tracks.length === 0} query={popular} ownerUrn={urn}>
      <TrackColumns shape={shape}>
        <VirtualList
          items={tracks}
          rowHeight={72}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(t) => t.urn}
          renderItem={renderItem}
        />
      </TrackColumns>
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
    <TabWrapper
      isLoading={q.isLoading}
      isEmpty={q.playlists.length === 0}
      query={q}
      ownerUrn={urn}
      scope="playlists"
    >
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
        {q.isFetchingNextPage && <Loader2 size={20} className="text-ink-20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

export function UserLikesTab({ urn }: { urn: string }) {
  const q = useUserLikedTracks(urn);
  const shape = useThemedShape();
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);
  const renderItem = useCallback(
    (track: (typeof q.tracks)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={q.tracks} />
    ),
    [q.tracks],
  );
  return (
    <TabWrapper
      isLoading={q.isLoading}
      isEmpty={q.tracks.length === 0}
      query={q}
      ownerUrn={urn}
      scope="likes"
    >
      <TrackColumns shape={shape}>
        <VirtualList
          items={q.tracks}
          rowHeight={72}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(t) => t.urn}
          renderItem={renderItem}
        />
      </TrackColumns>
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-ink-20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

export function UserSearchTracksTab({ urn, query }: { urn: string; query: string }) {
  const { t } = useTranslation();
  const q = useCatalogTracks(query.trim(), urn);
  const shape = useThemedShape(urn);
  const ref = useInfiniteScroll(
    !!q.hasNextPage && !q.isFetchNextPageError,
    !!q.isFetchingNextPage,
    q.fetchNextPage,
  );
  const renderItem = useCallback(
    (track: (typeof q.items)[number], i: number) => (
      <ThemedTrackRow track={track} index={i} queue={q.items} />
    ),
    [q.items],
  );
  return (
    <TabWrapper
      isLoading={q.isLoading}
      isEmpty={q.items.length === 0}
      emptyText={t('user.search.empty')}
      isError={q.isError}
      onRetry={() => void q.refetch()}
    >
      <TrackColumns shape={shape}>
        <VirtualList
          items={q.items}
          rowHeight={72}
          overscan={8}
          className="flex flex-col gap-1"
          getItemKey={(t) => t.urn}
          renderItem={renderItem}
        />
      </TrackColumns>
      <div ref={ref} className="h-16 flex items-center justify-center">
        {q.isFetchingNextPage && <Loader2 size={20} className="text-ink-20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}

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
        {q.isFetchingNextPage && <Loader2 size={20} className="text-ink-20 animate-spin" />}
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
  const followers = useUserFollowers(mode === 'followers' ? urn : undefined);
  const followings = useUserFollowings(mode === 'followings' ? urn : undefined);
  const q = mode === 'followers' ? followers : followings;
  const ref = useInfiniteScroll(!!q.hasNextPage, !!q.isFetchingNextPage, q.fetchNextPage);

  const renderItem = useCallback(
    (user: (typeof q.users)[number]) => (
      <button
        type="button"
        onClick={() => nav(`/user/${encodeURIComponent(user.urn)}`)}
        className="group relative h-full w-full flex flex-col items-center gap-3 p-6 rounded-3xl border border-ink/[0.08] bg-ink/[0.025] transition-colors duration-200 cursor-pointer overflow-hidden hover:border-ink/[0.14] hover:bg-ink/[0.04]"
      >
        <div className="w-20 h-20 rounded-full overflow-hidden ring-1 ring-ink/10 group-hover:ring-ink/20 transition-shadow duration-200">
          <Avatar src={user.avatar_url} alt={user.username} size={80} />
        </div>
        <div className="text-center min-w-0 w-full">
          <p className="text-[13px] font-semibold text-ink-90 truncate group-hover:text-ink">
            {user.username}
          </p>
          {user.followers_count != null && (
            <p className="text-[10px] text-ink-30 mt-1 tabular-nums uppercase tracking-widest font-semibold">
              {fc(user.followers_count)} {t('user.followers')}
            </p>
          )}
        </div>
      </button>
    ),
    [nav, t],
  );

  const emptyText = mode === 'followers' ? t('user.noFollowers') : t('user.noFollowings');

  return (
    <TabWrapper
      isLoading={q.isLoading}
      isEmpty={q.users.length === 0}
      emptyText={emptyText}
      query={q}
      ownerUrn={urn}
      scope="followings"
    >
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
        {q.isFetchingNextPage && <Loader2 size={20} className="text-ink-20 animate-spin" />}
      </div>
    </TabWrapper>
  );
}
