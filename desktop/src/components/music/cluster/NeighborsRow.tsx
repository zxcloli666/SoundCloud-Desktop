import React, {useMemo} from 'react';
import {ClusterFeedbackProvider} from '../../../lib/recsFeedback';
import type {Track} from '../../../stores/player';
import {HorizontalScroll} from '../../ui/HorizontalScroll';
import {ClusterHeader} from './ClusterHeader';
import {NeighborCard} from './NeighborCard';
import type {ClusterHydrated, ClusterNeighborDto} from './types';

interface Props {
  title: string;
  description: string;
  icon: React.ReactNode;
  index: number;
  cluster: ClusterHydrated;
  cardWidth?: number;
  /** Секция-обёртка уже рисует свой заголовок (станции «Эфира»). */
  hideHeader?: boolean;
}

export const NeighborsRow = React.memo(function NeighborsRow({
  title,
  description,
  icon,
  index,
  cluster,
  cardWidth = 200,
  hideHeader = false,
}: Props) {
  const tracksByUrn = useMemo(
    () => new Map(cluster.tracks.map((t) => [t.urn, t])),
    [cluster.tracks],
  );

  const pairs = useMemo<Array<{ neighbor: ClusterNeighborDto; track: Track }>>(() => {
    if (!cluster.neighbors) return [];
    const out: Array<{ neighbor: ClusterNeighborDto; track: Track }> = [];
    for (const n of cluster.neighbors) {
      const t = tracksByUrn.get(n.track_urn);
      if (t) out.push({ neighbor: n, track: t });
    }
    return out;
  }, [cluster.neighbors, tracksByUrn]);

  const ctx = useMemo(() => ({ clusterId: String(cluster.id) }), [cluster.id]);

  if (pairs.length === 0) return null;

  return (
    <ClusterFeedbackProvider value={ctx}>
      <div className="flex flex-col gap-3.5">
        {!hideHeader && (
          <ClusterHeader icon={icon} title={title} description={description} index={index} />
        )}
        <HorizontalScroll>
          {pairs.map(({ neighbor, track }) => (
            <div key={neighbor.artist_id} className="shrink-0" style={{ width: cardWidth }}>
              <NeighborCard
                neighbor={neighbor}
                track={track}
              />
            </div>
          ))}
        </HorizontalScroll>
      </div>
    </ClusterFeedbackProvider>
  );
});
