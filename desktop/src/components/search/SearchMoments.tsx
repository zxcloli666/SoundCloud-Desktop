import { LayoutGrid, SearchX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchMode } from '../../stores/searchPrefs';
import { useSearchPrefsStore } from '../../stores/searchPrefs';
import { RIVER_KEYFRAMES } from '../home/river/keyframes';
import { MOMENTS_KEYFRAMES } from '../moments/keyframes';
import { MomentsBackdrop, MomentsLoading } from '../moments/MomentsChrome';
import { MomentsStage } from '../moments/MomentsStage';
import { useMomentsFeed } from '../moments/use-moments-feed';
import { useSearchSource } from '../moments/use-search-source';
import { SearchState } from './SearchState';
import { SearchWaveTail } from './SearchWaveTail';

export function SearchMoments({ mode, q }: { mode: SearchMode; q: string }) {
  const { t } = useTranslation();
  const setView = useSearchPrefsStore((s) => s.setView);
  const [fromUrn] = useState(() => useSearchPrefsStore.getState().fromUrn);
  const source = useSearchSource(mode, q, fromUrn);
  const feed = useMomentsFeed(source);
  const current = feed.tracks[feed.index] ?? source.found[0];

  return (
    <div data-ui="search-moments" className="relative flex min-h-0 flex-1 flex-col">
      <style>{MOMENTS_KEYFRAMES + RIVER_KEYFRAMES}</style>
      <MomentsBackdrop artworkUrl={current?.artwork_url ?? null} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col" style={{ isolation: 'isolate' }}>
        {feed.status === 'loading' ? (
          <MomentsLoading />
        ) : feed.status === 'empty' ? (
          <SearchState
            icon={<SearchX size={26} />}
            title={t('search.view.empty', { query: q })}
            cta={t('search.view.covers')}
            ctaIcon={<LayoutGrid size={15} />}
            onAction={() => setView('covers')}
          />
        ) : (
          <MomentsStage
            tracks={feed.tracks}
            index={feed.index}
            go={feed.go}
            toggle={feed.toggle}
            listenFull={feed.listenFull}
            tail={
              source.tail && (
                <SearchWaveTail
                  found={source.found}
                  busy={source.continuing}
                  onContinue={source.continueAsWave}
                />
              )
            }
          />
        )}
      </div>
    </div>
  );
}
