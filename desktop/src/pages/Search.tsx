import { useEffect } from 'react';
import { useDebouncedValue } from '../components/discover/useDebouncedValue';
import { Atmosphere } from '../components/search/Atmosphere';
import { CatalogResults } from '../components/search/CatalogResults';
import { LinkOpen } from '../components/search/LinkOpen';
import { SearchLanding } from '../components/search/SearchLanding';
import { SearchModeTabs } from '../components/search/SearchModeTabs';
import { SoundCloudResults } from '../components/search/SoundCloudResults';
import { WALL_KEYFRAMES } from '../components/search/utils';
import { VibeResults } from '../components/search/VibeResults';
import { useTabHidden } from '../components/search/Wall';
import { stopHoverPreview, wirePreviewGuards } from '../lib/audioPreview';
import { MIN_SEARCH_QUERY } from '../lib/search';
import { findSoundCloudLink } from '../lib/soundcloudLink';
import { useSearchPrefsStore } from '../stores/searchPrefs';
import { useSearchQueryStore } from '../stores/searchQuery';

const DEBOUNCE_MS = 350;

export function Search() {
  const q = useSearchQueryStore((s) => s.q);
  const mode = useSearchPrefsStore((s) => s.mode);
  const typed = q.trim();
  const query = useDebouncedValue(typed, DEBOUNCE_MS);
  const queryLink = findSoundCloudLink(query);
  const link = query === typed ? queryLink : null;
  const hidden = useTabHidden();
  const searching = !queryLink && !findSoundCloudLink(typed) && query.length >= MIN_SEARCH_QUERY;

  useEffect(() => {
    wirePreviewGuards();
    return () => stopHoverPreview();
  }, []);

  return (
    <div className="relative min-h-full w-full" data-tg-hidden={hidden ? '1' : '0'}>
      <style>{WALL_KEYFRAMES}</style>
      {!(searching && mode === 'vibe') && <Atmosphere />}
      <div className="relative pt-5" style={{ isolation: 'isolate' }}>
        {link ? (
          <LinkOpen key={link.kind === 'urn' ? link.urn : link.url} link={link} />
        ) : (
          <>
            <SearchModeTabs />
            {!searching ? (
              <SearchLanding />
            ) : mode === 'catalog' ? (
              <CatalogResults q={query} />
            ) : mode === 'vibe' ? (
              <VibeResults q={query} />
            ) : (
              <SoundCloudResults q={query} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
