import React from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentTime, handlePrev } from '../../../lib/audio';
import {
  Pause,
  Play,
  repeat1Icon16,
  repeatAbIcon16,
  repeatIcon16,
  shuffleIcon16,
  skipBack20,
  skipForward20,
} from '../../../lib/icons';
import { usePlayerStore } from '../../../stores/player';
import { playerBtn } from './button-class';

export const PlayPauseBtn = React.memo(() => {
  const { t } = useTranslation();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const title = isPlaying ? t('track.pause') : t('track.play');
  return (
    <button
      type="button"
      onClick={togglePlay}
      title={title}
      aria-label={title}
      data-ui="play-button"
      className="npb-play"
    >
      {isPlaying ? (
        <Pause size={20} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play size={20} fill="currentColor" strokeWidth={0} className="ml-0.5" />
      )}
    </button>
  );
});

export const PrevBtn = React.memo(() => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={handlePrev}
      title={t('player.previous')}
      aria-label={t('player.previous')}
      className={playerBtn(false)}
    >
      {skipBack20}
    </button>
  );
});

export const NextBtn = React.memo(() => {
  const { t } = useTranslation();
  const next = usePlayerStore((s) => s.next);
  return (
    <button
      type="button"
      onClick={next}
      title={t('player.next')}
      aria-label={t('player.next')}
      className={playerBtn(false)}
    >
      {skipForward20}
    </button>
  );
});

export const ShuffleBtn = React.memo(() => {
  const { t } = useTranslation();
  const shuffle = usePlayerStore((s) => s.shuffle);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  return (
    <button
      type="button"
      onClick={toggleShuffle}
      aria-pressed={shuffle}
      title={t('player.shuffle')}
      aria-label={t('player.shuffle')}
      data-ui="player-shuffle"
      className={playerBtn(shuffle)}
    >
      {shuffleIcon16}
    </button>
  );
});

export const RepeatBtn = React.memo(() => {
  const { t } = useTranslation();
  const repeat = usePlayerStore((s) => s.repeat);
  const toggleRepeat = usePlayerStore((s) => s.toggleRepeat);
  return (
    <button
      type="button"
      onClick={toggleRepeat}
      aria-pressed={repeat !== 'off'}
      title={t('player.repeat')}
      aria-label={t('player.repeat')}
      data-ui="player-repeat"
      className={playerBtn(repeat !== 'off')}
    >
      {repeat === 'one' ? repeat1Icon16 : repeatIcon16}
    </button>
  );
});

export const AbLoopBtn = React.memo(() => {
  const { t } = useTranslation();
  const abLoop = usePlayerStore((s) => s.abLoop);
  const cycleAbPoint = usePlayerStore((s) => s.cycleAbPoint);
  const awaitingB = abLoop != null && abLoop.b == null;
  const title = !abLoop
    ? t('player.abLoopSetA')
    : abLoop.b == null
      ? t('player.abLoopSetB')
      : t('player.abLoopClear');

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={abLoop != null}
      data-ui="player-abloop"
      onClick={() => cycleAbPoint(getCurrentTime())}
      className={`relative ${playerBtn(abLoop != null)}`}
    >
      {repeatAbIcon16}
      {awaitingB && (
        <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
      )}
    </button>
  );
});
