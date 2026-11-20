import { useTranslation } from 'react-i18next';
import { TRACK_COLUMN_MAX, TRACK_COLUMN_MIN, type TrackColumnId, useSettingsStore } from '../../../stores/settings';

const STEP = 8;

export function ColumnHandle({ id, width }: { id: TrackColumnId; width: number }) {
  const { t } = useTranslation();
  const setColumn = useSettingsStore((s) => s.setTrackColumn);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const onMove = (move: PointerEvent) => setColumn(id, startWidth + startX - move.clientX);
    const onUp = () => {
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
      target.removeEventListener('pointercancel', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
    target.addEventListener('pointercancel', onUp);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') setColumn(id, width + STEP);
    else if (event.key === 'ArrowRight') setColumn(id, width - STEP);
    else if (event.key === 'Home') setColumn(id, null);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-valuemin={TRACK_COLUMN_MIN}
      aria-valuemax={TRACK_COLUMN_MAX}
      aria-valuenow={width}
      aria-label={t(id === 'plays' ? 'track.plays' : 'track.likes')}
      title={t('track.columnResize')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={() => setColumn(id, null)}
      onKeyDown={onKeyDown}
      className="group/handle absolute -left-3 top-0 bottom-0 z-10 flex w-3 cursor-col-resize items-center justify-center touch-none outline-none"
    >
      <span className="h-4 w-px rounded-full bg-ink/15 transition-all duration-150 group-hover/handle:h-5 group-hover/handle:w-0.5 group-hover/handle:bg-accent group-focus-visible/handle:bg-accent" />
    </div>
  );
}
