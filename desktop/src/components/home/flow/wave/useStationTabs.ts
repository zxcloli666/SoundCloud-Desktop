import { useTranslation } from 'react-i18next';
import type { StationId } from '../../../../lib/layout';
import type { WaveTab } from './WaveTabs';

export function useStationTabs(
  ids: StationId[],
  choose: (id: StationId) => void,
): { wave: WaveTab; stations: WaveTab[] } {
  const { t } = useTranslation();
  const stations = ids
    .filter((id) => id !== 'wave')
    .map((id) => ({ id, label: t(`soundwave.home.cluster.${id}`), pick: () => choose(id) }));
  return {
    wave: { id: 'wave', label: t('flowRedesign.waveTitle'), pick: () => choose('wave') },
    stations,
  };
}
