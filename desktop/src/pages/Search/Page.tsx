import { Loader2, Search as SearchIcon, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchPlaylists, useSearchTracks, useSearchUsers } from '../../api/index.ts';
import { PlaylistCard } from '../../components/common/PlaylistCard.tsx';
import { SegmentedTabs } from '../../components/common/SegmentedTabs.tsx';
import { TrackRow } from '../../components/track/TrackRow.tsx';
import { UserCard } from '../../components/user/UserCard.tsx';
import { useInfiniteScroll } from '../../lib/useInfiniteScroll.ts';

type TabsId = 'tracks' | 'playlists' | 'users';

const SearchBase = () => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'tracks' | 'playlists' | 'users'>('tracks');

  // Debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 500);
    return () => clearTimeout(handler);
  }, [inputValue]);

  // Queries
  const tracksQuery = useSearchTracks(debouncedQuery);
  const playlistsQuery = useSearchPlaylists(debouncedQuery);
  const usersQuery = useSearchUsers(debouncedQuery);

  // Determine active query for infinite scroll
  const activeQuery =
    activeTab === 'tracks' ? tracksQuery : activeTab === 'playlists' ? playlistsQuery : usersQuery;

  const sentinelRef = useInfiniteScroll(
    !!activeQuery.hasNextPage,
    !!activeQuery.isFetchingNextPage,
    activeQuery.fetchNextPage,
  );

  const tabs: { id: TabsId; label: string }[] = [
    { id: 'tracks', label: t('search.tracks') },
    { id: 'playlists', label: t('search.playlists') },
    { id: 'users', label: t('search.users') },
  ];

  const renderContent = () => {
    if (!debouncedQuery) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-white/20">
          <SearchIcon size={48} className="mb-4 opacity-50" />
          <p className="text-sm font-medium">Search for artists, bands, tracks, podcasts</p>
        </div>
      );
    }

    if (activeTab === 'tracks') {
      const uniqueTracks = Array.from(new Map(tracksQuery.tracks.map((t) => [t.urn, t])).values());

      if (tracksQuery.isLoading)
        return (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/20" />
          </div>
        );
      if (uniqueTracks.length === 0)
        return <div className="py-20 text-center text-white/30">{t('search.noResults')}</div>;

      return (
        <div className="flex flex-col gap-1">
          {uniqueTracks.map((track, i) => (
            <TrackRow key={`${track.urn}-${i}`} track={track} queue={uniqueTracks} />
          ))}
        </div>
      );
    }

    if (activeTab === 'playlists') {
      const uniquePlaylists = Array.from(
        new Map(playlistsQuery.playlists.map((p) => [p.urn, p])).values(),
      );

      if (playlistsQuery.isLoading)
        return (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/20" />
          </div>
        );
      if (uniquePlaylists.length === 0)
        return <div className="py-20 text-center text-white/30">{t('search.noResults')}</div>;

      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {uniquePlaylists.map((p, i) => (
            <PlaylistCard key={`${p.urn}-${i}`} playlist={p} />
          ))}
        </div>
      );
    }

    if (activeTab === 'users') {
      const uniqueUsers = Array.from(new Map(usersQuery.users.map((u) => [u.urn, u])).values());

      if (usersQuery.isLoading)
        return (
          <div className="flex justify-center py-20">
            <Loader2 size={32} className="animate-spin text-white/20" />
          </div>
        );
      if (uniqueUsers.length === 0)
        return <div className="py-20 text-center text-white/30">{t('search.noResults')}</div>;

      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {uniqueUsers.map((u, i) => (
            <UserCard key={`${u.urn}-${i}`} user={u} />
          ))}
        </div>
      );
    }
  };

  return (
    <div className="p-6 pb-4 space-y-8 animate-fade-in-up">
      {/* ── Search Input ── */}
      <div className="relative max-w-2xl mx-auto">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <SearchIcon size={20} className="text-white/40" />
        </div>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={t('search.placeholder')}
          className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.08] text-white placeholder:text-white/30 text-[16px] py-4 pl-12 pr-12 rounded-[20px] outline-none border border-white/[0.05] focus:border-accent/30 focus:ring-1 focus:ring-accent/30 transition-all duration-300 shadow-xl backdrop-blur-md"
          autoFocus
        />
        {inputValue && (
          <button
            onClick={() => setInputValue('')}
            className="absolute inset-y-0 right-4 flex items-center text-white/30 hover:text-white cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* ── Tabs ── */}
      {debouncedQuery && (
        <SegmentedTabs items={tabs} value={activeTab} onChange={setActiveTab} align="center" />
      )}

      {/* ── Content ── */}
      <div className="min-h-[400px]">
        {renderContent()}

        {/* Sentinel */}
        <div ref={sentinelRef} className="h-20 flex items-center justify-center mt-6">
          {activeQuery.isFetchingNextPage && (
            <Loader2 size={24} className="text-white/20 animate-spin" />
          )}
        </div>
      </div>
    </div>
  );
};
export const Search = React.memo(SearchBase);
