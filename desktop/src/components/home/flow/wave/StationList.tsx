import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { StationId } from '../../../../lib/layout';
import { ClusterFeedbackProvider } from '../../../../lib/recsFeedback';
import { TrackRow } from '../TrackRow';
import { stationRows, type WaveFeed } from './stations';

const ROWS = [0, 1, 2, 3, 4];
const BOX = 'flex h-[362px] flex-col gap-2';
const SCROLL =
  'snap-y snap-proximity overflow-y-auto overscroll-contain pb-6 scrollbar-hide [mask-image:linear-gradient(#000_calc(100%-30px),transparent)]';

function Placeholder() {
  return (
    <div aria-busy className={BOX}>
      {ROWS.map((row) => (
        <span key={row} className="h-[66px] shrink-0 rounded-[13px] bg-ink/[0.03]" />
      ))}
    </div>
  );
}

function Trouble({ feed }: { feed: WaveFeed }) {
  const { t } = useTranslation();
  return (
    <div
      data-ui="wave-trouble"
      className={`${BOX} items-start px-1 py-4 text-[12.5px] text-ink-45`}
    >
      <p className="text-[13.5px] font-semibold text-ink-80">
        {t(`soundwave.${feed.trouble}Title`)}
      </p>
      <p>{t(`soundwave.${feed.trouble}Desc`)}</p>
      {feed.trouble === 'error' && (
        <button
          type="button"
          onClick={feed.onRetry}
          className="mt-1 cursor-pointer font-semibold text-accent transition-[filter] hover:brightness-110"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}

interface Props {
  station: StationId;
  feed: WaveFeed;
  framed?: boolean;
}

export function StationList({ station, feed, framed }: Props) {
  const rows = useMemo(() => stationRows(station, feed), [station, feed]);
  const feedback = useMemo(() => ({ clusterId: station }), [station]);

  if (rows.length === 0) {
    return feed.trouble ? <Trouble feed={feed} /> : <Placeholder />;
  }
  return (
    <ClusterFeedbackProvider value={feedback}>
      <ul key={station} className={`${BOX} ${rows.length > ROWS.length ? SCROLL : ''}`}>
        {rows.map((row) => (
          <li key={row.track.urn} data-ui="wave-row" className="snap-start">
            <TrackRow track={row.track} artist={row.artist} onPlay={row.start} framed={framed} />
          </li>
        ))}
      </ul>
    </ClusterFeedbackProvider>
  );
}
