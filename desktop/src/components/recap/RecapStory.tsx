import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ListeningStats } from '../library/stats/useListeningStats';
import { RecapSlide, slideKinds } from './RecapSlides';

const SLIDE_MS = 7_000;
const HOLD_MS = 250;

/** The year as a story: one slide at a time, tap or arrow keys to move, hold to pause, auto-advance till the end. */
export const RecapStory = memo(function RecapStory({
  year,
  stats,
}: {
  year: number;
  stats: ListeningStats;
}) {
  const { t } = useTranslation();
  const kinds = useMemo(() => slideKinds(stats), [stats]);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const pressedAt = useRef(0);
  const last = index === kinds.length - 1;

  const next = useCallback(
    () => setIndex((i) => Math.min(i + 1, kinds.length - 1)),
    [kinds.length],
  );
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
  const restart = useCallback(() => setIndex(0), []);
  const tap = (go: () => void) => () => {
    if (Date.now() - pressedAt.current < HOLD_MS) go();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex gap-1.5 px-1 pt-2">
        {kinds.map((kind, i) => (
          <span key={kind} className="h-[3px] flex-1 overflow-hidden rounded-full bg-ink/[0.12]">
            <span
              key={i === index ? `run-${index}` : kind}
              className="block h-full origin-left rounded-full bg-ink/85"
              onAnimationEnd={i === index && !last ? next : undefined}
              style={{
                transform: i < index || (i === index && last) ? 'scaleX(1)' : 'scaleX(0)',
                animation:
                  i === index && !last ? `recap-fill ${SLIDE_MS}ms linear forwards` : undefined,
                animationPlayState: held ? 'paused' : 'running',
              }}
            />
          </span>
        ))}
      </div>

      <div
        className="relative flex-1"
        onPointerDown={() => {
          pressedAt.current = Date.now();
          setHeld(true);
        }}
        onPointerUp={() => setHeld(false)}
        onPointerLeave={() => setHeld(false)}
      >
        <button
          type="button"
          aria-label={t('common.back')}
          onClick={tap(prev)}
          className="absolute inset-y-0 left-0 z-10 w-1/3 cursor-w-resize"
        />
        {!last && (
          <button
            type="button"
            aria-label={t('recap.next')}
            onClick={tap(next)}
            className="absolute inset-y-0 right-0 z-10 w-2/3 cursor-e-resize"
          />
        )}
        <div
          key={index}
          className="pointer-events-none relative z-20 h-full animate-in fade-in zoom-in-95 duration-700"
        >
          <RecapSlide kind={kinds[index]} year={year} stats={stats} onRestart={restart} />
        </div>
      </div>
    </div>
  );
});
