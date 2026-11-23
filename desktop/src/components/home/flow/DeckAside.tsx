import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { StationId } from '../../../lib/layout';
import { useSettingsStore } from '../../../stores/settings';
import { UpNext, useUpcoming } from './UpNext';
import { StationList } from './wave/StationList';
import { useStations, type WaveFeed } from './wave/stations';
import { useStationTabs } from './wave/useStationTabs';
import { WaveTabs } from './wave/WaveTabs';

const NARROW = '@min-[1180px]:hidden';

export function DeckAside({ feed, idle }: { feed: WaveFeed; idle: boolean }) {
  const { t } = useTranslation();
  const panelId = useId();
  const upcoming = useUpcoming();
  const saved = useSettingsStore((s) => s.homeAside);
  const setAside = useSettingsStore((s) => s.setHomeAside);
  const setStation = useSettingsStore((s) => s.setHomeStation);
  const { ids, active } = useStations(feed);
  const choose = (id: StationId) => {
    setAside('wave');
    setStation(id);
  };
  const { wave, stations } = useStationTabs(ids, choose);
  const queued = !idle && upcoming.length > 0;
  const onNext = queued && saved === 'next';
  const next = {
    id: 'next',
    label: t('flowRedesign.upNext'),
    pick: () => setAside('next'),
  };

  return (
    <div className={`flex flex-col gap-4 ${idle ? NARROW : ''}`}>
      <div className={NARROW}>
        <WaveTabs
          heads={queued ? [next, wave] : [wave]}
          stations={stations}
          value={onNext ? next.id : active}
          panelId={panelId}
        />
      </div>
      {!onNext && (
        <div id={panelId} role="tabpanel" className={NARROW}>
          <StationList station={active} feed={feed} framed />
        </div>
      )}
      {!idle && <UpNext id={onNext ? panelId : undefined} entries={upcoming} narrow={onNext} />}
    </div>
  );
}
