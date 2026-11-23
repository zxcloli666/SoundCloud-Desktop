import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { Track } from '../../../../stores/player';
import { useSettingsStore } from '../../../../stores/settings';
import { LyricCurrent } from '../DeckLyrics';
import { StationList } from './StationList';
import { useStations, type WaveFeed } from './stations';
import { useStationTabs } from './useStationTabs';
import { WaveTabs } from './WaveTabs';

export function WavePane({ feed, current }: { feed: WaveFeed; current: Track | null }) {
  const { t } = useTranslation();
  const panelId = useId();
  const { ids, active } = useStations(feed);
  const { wave, stations } = useStationTabs(
    ids,
    useSettingsStore((s) => s.setHomeStation),
  );
  return (
    <section
      data-ui="wave-pane"
      aria-label={t('flowRedesign.waveTitle')}
      className="hidden w-full max-w-[360px] min-w-0 flex-col gap-5 self-center @min-[1180px]:col-start-1 @min-[1180px]:row-start-1 @min-[1180px]:flex"
    >
      <WaveTabs heads={[wave]} stations={stations} value={active} panelId={panelId} />
      <div id={panelId} role={stations.length > 0 ? 'tabpanel' : undefined}>
        <StationList station={active} feed={feed} />
      </div>
      {current && <LyricCurrent track={current} />}
    </section>
  );
}
