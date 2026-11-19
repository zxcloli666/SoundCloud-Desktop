import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentTime, getDuration, subscribe } from '../../lib/audio';
import { durLong, fc } from '../../lib/formatters';
import { emojiOf, type Moments, useMoments, type ValueCount } from '../../lib/moment-reactions';
import { useMomentReads, useReactionValues } from '../../lib/moment-reactions-sync';

const SLOTS = 26;
const BLOOM_MS = 2400;

interface Mark {
  pct: number;
  second: number;
  total: number;
  counts: ValueCount[];
  own: boolean;
}

function marksOf(moments: Moments, durationMs: number): Mark[] {
  if (durationMs <= 0) return [];
  const slots = new Map<number, Mark & { best: number }>();
  for (const [second, moment] of moments) {
    if (moment.total <= 0) continue;
    const pct = Math.min(1, (second * 1000) / durationMs);
    const slot = Math.round(pct * SLOTS);
    const mark = slots.get(slot);
    if (!mark) {
      slots.set(slot, {
        pct,
        second,
        total: moment.total,
        counts: moment.counts,
        own: moment.own !== null,
        best: moment.total,
      });
      continue;
    }
    mark.total += moment.total;
    mark.own ||= moment.own !== null;
    mark.counts = mergeCounts(mark.counts, moment.counts);
    if (moment.total > mark.best) Object.assign(mark, { pct, second, best: moment.total });
  }
  return [...slots.values()].sort((a, b) => a.pct - b.pct);
}

function mergeCounts(left: ValueCount[], right: ValueCount[]): ValueCount[] {
  const sum = new Map<string, number>();
  for (const { valueUrn, count } of [...left, ...right]) {
    sum.set(valueUrn, (sum.get(valueUrn) ?? 0) + count);
  }
  return [...sum]
    .map(([valueUrn, count]) => ({ valueUrn, count }))
    .sort((a, b) => b.count - a.count);
}

export const MomentMarks = React.memo(function MomentMarks({
  trackUrn,
  durationMs,
  isCurrent,
  onSeek,
}: {
  trackUrn: string;
  durationMs: number;
  isCurrent: boolean;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  const moments = useMoments(trackUrn);
  const values = useReactionValues();
  useMomentReads(trackUrn, durationMs, isCurrent);
  const marks = useMemo(() => marksOf(moments, durationMs), [moments, durationMs]);
  const elements = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (!isCurrent || marks.length === 0) return;
    const timers = new Map<number, ReturnType<typeof setTimeout>>();
    const ratio = () => {
      const duration = getDuration();
      return duration > 0 ? Math.min(1, getCurrentTime() / duration) : 0;
    };
    let before = ratio();

    const bloom = (index: number) => {
      const element = elements.current[index];
      if (!element) return;
      element.dataset.bloom = '1';
      clearTimeout(timers.get(index));
      timers.set(
        index,
        setTimeout(() => {
          element.dataset.bloom = '0';
          timers.delete(index);
        }, BLOOM_MS),
      );
    };

    const stop = subscribe(() => {
      const now = ratio();
      const step = now - before;
      if (step > 0 && step < 0.03) {
        marks.forEach((mark, index) => {
          if (mark.pct > before && mark.pct <= now) bloom(index);
        });
      }
      before = now;
    });
    return () => {
      stop();
      for (const timer of timers.values()) clearTimeout(timer);
    };
  }, [isCurrent, marks]);

  if (marks.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-full mb-1 h-[18px] pointer-events-none z-10">
      {marks.map((mark, index) => (
        <button
          key={mark.second}
          type="button"
          data-ui="moment-reaction-mark"
          data-own={mark.own ? '1' : '0'}
          data-bloom="0"
          ref={(element) => {
            elements.current[index] = element;
          }}
          onClick={() => onSeek(mark.second)}
          aria-label={t('mobileActions.momentMark', {
            time: durLong(mark.second * 1000),
            count: mark.total,
          })}
          className="group/mark absolute bottom-0 -translate-x-1/2 pointer-events-auto cursor-pointer"
          style={{ left: `${mark.pct * 100}%` }}
        >
          <span
            className={`flex items-center gap-0.5 h-[18px] px-1.5 rounded-full text-[11px] leading-none font-semibold tabular-nums transition-transform duration-300 ease-[var(--ease-apple)] group-hover/mark:scale-110 group-data-[bloom=1]/mark:scale-125 ${
              mark.own ? 'bg-accent text-accent-contrast' : 'bg-ink/[0.08] text-ink-70'
            }`}
          >
            <span>{emojiOf(mark.counts[0].valueUrn, values)}</span>
            <span>{fc(mark.total)}</span>
          </span>
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 z-20 flex items-center gap-2 w-max px-2.5 py-1.5 rounded-xl text-[11.5px] tabular-nums text-ink-85 opacity-0 transition-opacity duration-200 group-hover/mark:opacity-100"
            style={{
              background: 'rgb(var(--surface-hi) / 0.92)',
              border: '0.5px solid rgb(var(--ink) / 0.12)',
              boxShadow: '0 12px 32px rgb(var(--shade) / calc(0.5 * var(--shade-alpha)))',
            }}
          >
            <span className="text-ink-45">{durLong(mark.second * 1000)}</span>
            {mark.counts.map((entry) => (
              <span key={entry.valueUrn}>
                {emojiOf(entry.valueUrn, values)} {fc(entry.count)}
              </span>
            ))}
          </span>
        </button>
      ))}
    </div>
  );
});
