import { clusterRows } from '../../../components/home/flow/wave/stations';
import { homeWaveQuery, keepVisible, loadClusters } from '../../../components/music/cluster';
import { useSettingsStore } from '../../../stores/settings';
import { currentFeedFilter } from '../../feed-filter';
import { isTrackLiked } from '../../likes';
import type { Station } from './ports';

export async function playStation(station: Station): Promise<boolean> {
  const settings = useSettingsStore.getState();
  const loaded = await loadClusters(
    homeWaveQuery({
      languages: settings.soundwaveLanguages,
      genres: settings.soundwaveGenres,
      hideListened: settings.soundwaveHideListened,
    }),
  );
  const allowed = currentFeedFilter();
  const { clusters } = keepVisible(
    loaded,
    (track) => allowed(track) && !(settings.soundwaveHideLiked && isTrackLiked(track)),
  );
  const cluster = clusters.find(({ id }) => id === station);
  const first = cluster && clusterRows(cluster)[0];
  if (!first) return false;
  settings.setHomeStation(station);
  first.start();
  return true;
}
