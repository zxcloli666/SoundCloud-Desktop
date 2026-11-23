import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import { useLayoutMenu } from '../../layout/LayoutMenu';
import type { PlayerContext } from '../../layout/player/PlayerButtons';
import { ZoneBoard } from '../../layout/player/zone-board';
import { DeckControls } from './DeckControls';
import { DeckCover } from './DeckCover';
import { DeckHeading } from './DeckHeading';
import { DeckIdle } from './DeckIdle';
import { LyricInline, LyricNext } from './DeckLyrics';
import { DeckTitle } from './DeckTitle';
import { UpNext } from './UpNext';
import { WavePane } from './WavePane';
import { WaveSettings } from './WaveSettings';

const NO_QUEUE: PlayerContext = { onQueueToggle: () => {}, queueOpen: false };

interface Props {
  waveTracks: Track[];
  canPlay: boolean;
  onPlayWave: () => void;
  spinning: boolean;
  onRefresh: () => void;
}

export function FlowDeck({ waveTracks, canPlay, onPlayWave, spinning, onRefresh }: Props) {
  const { t } = useTranslation();
  const ctx = useOutletContext<PlayerContext | undefined>() ?? NO_QUEUE;
  const track = usePlayerStore((s) => s.currentTrack);
  const menu = useLayoutMenu('deck');

  return (
    <section data-ui="soundwave" className="@container relative isolate">
      <div className="grid items-start gap-y-10 @min-[1180px]:grid-cols-[minmax(256px,326px)_minmax(0,1fr)_minmax(256px,326px)] @min-[1180px]:gap-x-[clamp(16px,2vw,34px)]">
        <WavePane tracks={waveTracks} current={track} />
        <div className="flex min-w-0 flex-col items-center @min-[1180px]:col-start-2 @min-[1180px]:row-start-1">
          {track ? (
            <>
              <DeckHeading track={track} />
              <DeckCover track={track} title={track.title} />
              <ZoneBoard surface="deck">
                <DeckTitle
                  track={track}
                  fallback={t('flowRedesign.idleTitle')}
                  ctx={ctx}
                  onContextMenu={menu.onContextMenu}
                />
                <DeckControls ctx={ctx} onContextMenu={menu.onContextMenu} />
              </ZoneBoard>
              {menu.menu}
              <LyricInline track={track} />
            </>
          ) : (
            <DeckIdle tracks={waveTracks} canPlay={canPlay} onPlay={onPlayWave} />
          )}
        </div>
        <aside className="flex w-full max-w-[550px] min-w-0 flex-col gap-3 justify-self-center @min-[1180px]:col-start-3 @min-[1180px]:row-start-1 @min-[1180px]:max-w-[326px] @min-[1180px]:self-center @min-[1180px]:justify-self-end">
          {track && <UpNext />}
          <WaveSettings spinning={spinning} onRefresh={onRefresh} />
          {track && <LyricNext track={track} />}
        </aside>
      </div>
    </section>
  );
}
