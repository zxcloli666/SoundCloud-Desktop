import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { IdentityHub } from '../components/user/IdentityHub';
import { USER_PAGE_KEYFRAMES } from '../components/user/keyframes';
import { TabDock, type TabId } from '../components/user/TabDock';
import { UserSearchBox } from '../components/user/UserSearchBox';
import {
  UserConnectionsTab,
  UserLikesTab,
  UserPlaylistsTab,
  UserPopularTab,
  UserSearchPlaylistsTab,
  UserSearchTracksTab,
  UserTracksTab,
} from '../components/user/UserTabs';
import { useEditableUserAura, useUserAura } from '../components/user/useUserAura';
import { useUser, useUserWebProfiles } from '../lib/hooks';
import { Loader2 } from '../lib/icons';
import { likedTracksCount } from '../lib/likes';
import { useAuthStore } from '../stores/auth';

/**
 * Какие табы поддерживают inline-поиск по контенту юзера. На followers/
 * following/likes контент принадлежит другим людям / SC owns it — локальный
 * trgm-поиск там не имеет смысла. На popular/tracks/playlists скоуп — наш.
 */
function isSearchableScope(tab: TabId): boolean {
  return tab === 'popular' || tab === 'tracks' || tab === 'playlists';
}

function searchableScopeLabelKey(tab: TabId): string {
  if (tab === 'playlists') return 'playlists';
  return 'tracks';
}

export function UserPage() {
  const { urn } = useParams<{ urn: string }>();
  const { t } = useTranslation();
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabId>('popular');
  // Inline-поиск по контенту юзера. Debounce 350ms — баланс между "не лагает
  // на каждый символ" и "ощущается отзывчиво". Поиск работает только в
  // tracks/popular/playlists скоупах — в followers/following/likes контент
  // принадлежит другим юзерам/SC API, локальный фильтр там бессмысленен.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(handler);
  }, [searchInput]);
  // При смене таба чистим поиск — иначе при переходе followers→tracks инпут
  // покажет старую строку, у которой уже был отдельный контекст. activeTab —
  // именно триггер эффекта, тело его не читает.
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeTab is the trigger
  useEffect(() => {
    setSearchInput('');
    setDebouncedSearch('');
  }, [activeTab]);

  const { data: user, isLoading: userLoading } = useUser(urn);
  const { data: webProfiles } = useUserWebProfiles(urn);

  const isOwnProfile = !!user && currentUser?.urn === user.urn;

  // Aura customization is a regular profile feature in this fork.
  const hasStar = true;

  const readonly = useUserAura(urn, !isOwnProfile);
  const editable = useEditableUserAura(urn, isOwnProfile);

  const aura = isOwnProfile ? editable.aura : readonly.aura;
  const customHex = isOwnProfile ? editable.customHex : readonly.customHex;

  const tabs = useMemo(() => {
    if (!user) return [] as const;
    return [
      { id: 'popular' as const, label: t('user.popular'), count: undefined },
      { id: 'tracks' as const, label: t('user.tracks'), count: user.track_count },
      { id: 'playlists' as const, label: t('user.playlists'), count: user.playlist_count },
      { id: 'likes' as const, label: t('user.likes'), count: likedTracksCount(user) },
      { id: 'followers' as const, label: t('user.followers'), count: user.followers_count },
      { id: 'following' as const, label: t('user.following'), count: user.followings_count },
    ] as const;
  }, [user, t]);

  if (userLoading || !user) {
    return (
      <div className="relative w-full min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="text-white/30 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <style>{USER_PAGE_KEYFRAMES}</style>
      <div className="sonveil-detail-page">
        <div className="sonveil-detail-content" style={{ isolation: 'isolate' }}>
          <IdentityHub
            user={user}
            hasStar={hasStar}
            webProfiles={webProfiles}
            aura={aura}
            isOwnProfile={isOwnProfile}
            customHex={customHex}
            onPickAura={editable.onPickAura}
            onPickCustom={editable.onPickCustom}
          />

          <div className="mt-10 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <TabDock tabs={tabs} active={activeTab} onChange={setActiveTab} aura={aura} />
            <div className="md:max-w-sm md:w-80 w-full">
              <UserSearchBox
                value={searchInput}
                onChange={setSearchInput}
                scopeLabel={t(`user.${searchableScopeLabelKey(activeTab)}`)}
                disabled={!isSearchableScope(activeTab)}
              />
            </div>
          </div>

          <div className="sonveil-detail-surface">
            {(() => {
              const searching = !!debouncedSearch && isSearchableScope(activeTab);
              if (searching && (activeTab === 'tracks' || activeTab === 'popular')) {
                return <UserSearchTracksTab urn={urn!} aura={aura} query={debouncedSearch} />;
              }
              if (searching && activeTab === 'playlists') {
                return <UserSearchPlaylistsTab urn={urn!} query={debouncedSearch} />;
              }
              if (activeTab === 'popular') return <UserPopularTab urn={urn!} aura={aura} />;
              if (activeTab === 'tracks') return <UserTracksTab urn={urn!} aura={aura} />;
              if (activeTab === 'playlists') return <UserPlaylistsTab urn={urn!} />;
              if (activeTab === 'likes') return <UserLikesTab urn={urn!} aura={aura} />;
              if (activeTab === 'followers')
                return <UserConnectionsTab urn={urn!} mode="followers" />;
              if (activeTab === 'following')
                return <UserConnectionsTab urn={urn!} mode="followings" />;
              return null;
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
