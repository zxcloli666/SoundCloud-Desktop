import { useTranslation } from 'react-i18next';
import { Sparkles } from '../../../lib/icons';
import type { RiverSectionId } from '../../../lib/layout';
import type { Track } from '../../../stores/player';
import {
  ClusterEmptyState,
  type ClusterHydrated,
  ClusterRow,
  ClusterSkeletonState,
  NeighborsRow,
} from '../../music/cluster';
import { ArtistWire } from './ArtistWire';
import { MomentsStation } from './MomentsStation';
import { RiverSection } from './RiverSection';
import { DeepShelf, ReleaseBrook, VibeShelf } from './stations';
import { WaveSchedule } from './WaveSchedule';

interface Props {
  loading: boolean;
  cold: 'error' | 'allLiked' | 'building' | 'cold' | null;
  onRetry: () => void;
  clusters: Map<string, ClusterHydrated>;
  hidden: ReadonlySet<RiverSectionId>;
  moments: Track[];
}

function Plain({ cluster }: { cluster: ClusterHydrated }) {
  return (
    <ClusterRow
      hideHeader
      clusterId={cluster.id}
      title=""
      description=""
      icon={null}
      index={0}
      tracks={cluster.tracks}
      queue={cluster.tracks}
    />
  );
}

export function RiverSections({ loading, cold, onRetry, clusters, hidden, moments }: Props) {
  const { t } = useTranslation();
  const title = (id: string) => t(`soundwave.home.cluster.${id}`);
  const why = (id: string) => t(`soundwave.home.cluster.${id}Desc`);
  const pick = (id: RiverSectionId) => (hidden.has(id) ? undefined : clusters.get(id));

  const wave = pick('wave');
  const topArtists = pick('top_artists');
  const freshDrops = pick('fresh_drops');
  const sameVibe = pick('same_vibe');
  const adjacent = pick('adjacent');
  const deepCuts = pick('deep_cuts');
  const discover = pick('discover');
  const showMoments = moments.length > 0 && !hidden.has('moments');

  if (loading) return <ClusterSkeletonState rows={3} itemsPerRow={6} />;
  if (cold) {
    return (
      <ClusterEmptyState
        icon={<Sparkles size={20} style={{ color: 'var(--color-accent)' }} />}
        title={t(`soundwave.${cold}Title`)}
        description={t(`soundwave.${cold}Desc`)}
        cta={cold === 'error' ? t('common.retry') : undefined}
        onAction={onRetry}
      />
    );
  }

  return (
    <div className="flex flex-col gap-12">
      {wave && (
        <RiverSection title={title('wave')} why={why('wave')}>
          <WaveSchedule tracks={wave.tracks} />
        </RiverSection>
      )}
      {showMoments && (
        <RiverSection title={title('moments')} why={why('moments')}>
          <MomentsStation tracks={moments} />
        </RiverSection>
      )}
      {(topArtists || freshDrops) && (
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
          {topArtists && (
            <div className={`min-w-0 ${freshDrops ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              <RiverSection title={title('top_artists')} why={why('top_artists')}>
                {topArtists.neighbors?.length ? (
                  <ArtistWire cluster={topArtists} />
                ) : (
                  <Plain cluster={topArtists} />
                )}
              </RiverSection>
            </div>
          )}
          {freshDrops && (
            <div className={`min-w-0 ${topArtists ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
              <RiverSection title={title('fresh_drops')} why={why('fresh_drops')} tone="panel">
                <ReleaseBrook tracks={freshDrops.tracks} />
              </RiverSection>
            </div>
          )}
        </div>
      )}
      {(sameVibe || adjacent) && (
        <div className="grid items-start gap-10 lg:grid-cols-12 lg:gap-8">
          {sameVibe && (
            <div className={`min-w-0 ${adjacent ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
              <RiverSection title={title('same_vibe')} why={why('same_vibe')}>
                <VibeShelf tracks={sameVibe.tracks} />
              </RiverSection>
            </div>
          )}
          {adjacent && (
            <div className={`min-w-0 ${sameVibe ? 'lg:col-span-5' : 'lg:col-span-12'}`}>
              <RiverSection title={title('adjacent')} why={why('adjacent')} tone="panel">
                {adjacent.neighbors?.length ? (
                  <NeighborsRow
                    hideHeader
                    title=""
                    description=""
                    icon={null}
                    index={0}
                    cluster={adjacent}
                  />
                ) : (
                  <Plain cluster={adjacent} />
                )}
              </RiverSection>
            </div>
          )}
        </div>
      )}
      {deepCuts && (
        <RiverSection title={title('deep_cuts')} why={why('deep_cuts')} tone="deep">
          <DeepShelf tracks={deepCuts.tracks} />
        </RiverSection>
      )}
      {discover && (
        <RiverSection title={title('discover')} why={why('discover')}>
          <Plain cluster={discover} />
        </RiverSection>
      )}
    </div>
  );
}
