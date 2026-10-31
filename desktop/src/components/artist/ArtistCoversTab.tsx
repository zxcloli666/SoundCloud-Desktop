import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura } from '../../lib/aura';
import { Loader2, Music } from '../../lib/icons';
import type { Track } from '../../stores/player';
import { VirtualList } from '../ui/VirtualList';
import { ThemedTrackRow } from '../user/ThemedTrackRow';
import { useArtistCovers } from './useArtistData';

interface ArtistCoversTabProps {
  artistId: string;
  aura: Aura;
}

const ROW_HEIGHT = 72;

function ArtistCoversTabImpl({ artistId, aura }: ArtistCoversTabProps) {
  const { t } = useTranslation();
  const query = useArtistCovers(artistId);
  const tracks = useMemo(() => query.data ?? [], [query.data]);

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-ink-40">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  if (tracks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-ink-30 gap-3">
        <Music size={28} className="text-ink-15" />
        <p className="text-[13px]">{t('artist.noCovers', 'No covers yet')}</p>
      </div>
    );
  }
  return (
    <VirtualList<Track>
      items={tracks}
      rowHeight={ROW_HEIGHT}
      getItemKey={(t) => t.urn}
      renderItem={(track, index) => (
        <ThemedTrackRow track={track} index={index} queue={tracks} aura={aura} />
      )}
    />
  );
}

export const ArtistCoversTab = memo(ArtistCoversTabImpl);
