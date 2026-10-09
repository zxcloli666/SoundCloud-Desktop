import { RefreshCw, Sparkles } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRememberQuery, useVibe } from '../../lib/search';
import type { Track } from '../../stores/player';
import { Atmosphere } from './Atmosphere';
import { SearchError, SearchState } from './SearchState';
import { TrackWall } from './TrackWall';
import { genreColor, vibeEnergy } from './utils';

const NO_TINT: string[] = [];
const NO_TRACKS: Track[] = [];

export const VibeResults = memo(function VibeResults({ q }: { q: string }) {
  const { t } = useTranslation();
  const remember = useRememberQuery(q);
  const vibe = useVibe(q);
  const items = vibe.data && vibe.data.status !== 'preparing' ? vibe.data.items : NO_TRACKS;
  const top = vibe.data?.atmosphere?.topGenres ?? NO_TINT;

  const body = (() => {
    if (vibe.isError) return <SearchError error={vibe.error} onRetry={vibe.restart} />;
    if (vibe.slow)
      return (
        <SearchState
          icon={<Sparkles size={26} />}
          title={t('search.vibe.slowTitle')}
          body={t('search.vibe.slowBody')}
          cta={t('search.error.retry')}
          ctaIcon={<RefreshCw size={15} />}
          onAction={vibe.restart}
        />
      );
    if (vibe.preparing)
      return (
        <SearchState
          icon={<Sparkles size={26} className="animate-pulse" />}
          title={t('search.vibe.preparingTitle')}
          body={t('search.vibe.preparingBody')}
        />
      );
    if (!vibe.isLoading && items.length === 0)
      return (
        <SearchState
          icon={<Sparkles size={26} />}
          title={t('search.vibe.emptyTitle')}
          body={t('search.vibe.emptyBody')}
        />
      );
    return <TrackWall tracks={items} kind="vibe" isLoading={vibe.isLoading} onOpen={remember} />;
  })();

  return (
    <>
      <div className="relative -z-10">
        <Atmosphere tint={top.slice(0, 2).map(genreColor)} energy={vibeEnergy(top)} />
      </div>
      {body}
    </>
  );
});
