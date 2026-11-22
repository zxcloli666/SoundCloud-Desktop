import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { art } from '../../../lib/formatters';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';
import type { PlayerContext } from '../../layout/player/PlayerButtons';
import { DeckControls } from './DeckControls';
import { DeckCover } from './DeckCover';
import { DeckHeading } from './DeckHeading';
import { DeckIdle } from './DeckIdle';
import { DeckLyrics } from './DeckLyrics';
import { DeckSeek } from './DeckSeek';
import { DeckTitle } from './DeckTitle';
import { SceneBackground } from './scene/SceneBackground';
import { UpNext } from './UpNext';
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
  const playing = usePlayerStore((s) => s.isPlaying);
  const sceneTrack = track ?? waveTracks[0] ?? null;
  const artwork = art(sceneTrack?.artwork_url || sceneTrack?.user?.avatar_url, 't500x500');

  return (
    <section data-ui="soundwave" className="relative isolate">
      <SceneBackground artwork={artwork} playing={playing} />
      <div className="grid items-start gap-x-10 gap-y-8 px-2 pt-2 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col items-center gap-4">
          {track ? (
            <>
              <DeckHeading track={track} />
              <DeckCover track={track} title={track.title} />
              <DeckTitle track={track} fallback={t('flowRedesign.idleTitle')} />
              <DeckSeek />
              <DeckControls ctx={ctx} />
              <DeckLyrics track={track} />
            </>
          ) : (
            <DeckIdle tracks={waveTracks} canPlay={canPlay} onPlay={onPlayWave} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:pt-12">
          <UpNext waveTracks={waveTracks} ctx={ctx} />
          <WaveSettings spinning={spinning} onRefresh={onRefresh} />
        </div>
      </div>
    </section>
  );
}
