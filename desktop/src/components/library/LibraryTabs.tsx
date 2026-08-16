import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export type LibraryTab = 'tracks' | 'artists' | 'playlists' | 'albums';

const TABS: Array<{ id: LibraryTab; label: string; to: string }> = [
  { id: 'tracks', label: 'search.tracks', to: '/library/likes' },
  { id: 'artists', label: 'search.artists', to: '/library/following' },
  { id: 'playlists', label: 'search.playlists', to: '/library/playlists' },
  { id: 'albums', label: 'search.albums', to: '/library' },
];

export const LibraryTabs = memo(function LibraryTabs({ active }: { active?: LibraryTab }) {
  const { t } = useTranslation();

  return (
    <nav className="sonveil-library-tabs" aria-label={t('nav.library')}>
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          to={tab.to}
          className={active === tab.id ? 'is-active' : undefined}
          aria-current={active === tab.id ? 'page' : undefined}
        >
          {t(tab.label)}
        </Link>
      ))}
    </nav>
  );
});
