import { useTranslation } from 'react-i18next';
import { getCurrentTime } from '../../lib/audio';
import { formatTime } from '../../lib/formatters';
import { repeatAbIcon16, X } from '../../lib/icons';
import { usePlayerStore } from '../../stores/player';
import { chip, ICON_BTN, LABEL } from './styles';

export function LoopControl() {
  const { t } = useTranslation();
  const loop = usePlayerStore((s) => s.abLoop);
  const playing = usePlayerStore((s) => s.currentTrack !== null);
  const cycle = usePlayerStore((s) => s.cycleAbPoint);
  const nudge = usePlayerStore((s) => s.nudgeAbBound);
  const clear = usePlayerStore((s) => s.clearAbLoop);

  const setA = () => (loop ? nudge('a', getCurrentTime()) : cycle(getCurrentTime()));
  const setB = () => (loop?.b == null ? cycle(getCurrentTime()) : nudge('b', getCurrentTime()));

  return (
    <div data-ui="sound-loop" className="flex flex-col gap-1.5">
      <div className="flex h-7 items-center gap-2">
        <span className="text-ink-45 [&_svg]:size-[14px]" aria-hidden>
          {repeatAbIcon16}
        </span>
        <span className={LABEL}>{t('player.abLoopName')}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!playing}
          aria-pressed={loop !== null}
          title={t('player.abLoopSetA')}
          onClick={setA}
          className={`${chip(loop !== null)} min-w-[62px]`}
        >
          A{loop && <span className="text-ink-70">{formatTime(loop.a)}</span>}
        </button>
        <button
          type="button"
          disabled={!loop}
          aria-pressed={loop?.b != null}
          title={t('player.abLoopSetB')}
          onClick={setB}
          className={`${chip(loop?.b != null)} min-w-[62px]`}
        >
          B{loop?.b != null && <span className="text-ink-70">{formatTime(loop.b)}</span>}
        </button>
        <button
          type="button"
          onClick={clear}
          title={t('player.abLoopClear')}
          aria-label={t('player.abLoopClear')}
          className={`${ICON_BTN} ${loop ? '' : 'invisible'}`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}
