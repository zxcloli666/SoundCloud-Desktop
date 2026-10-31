import * as Popover from '@radix-ui/react-popover';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowDownAZ,
  ArrowUpDown,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Headphones,
  Heart,
  ListMusic,
  Loader2,
  Repeat2,
  RotateCcw,
  User,
} from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { TRACK_SORTS, type TrackSort } from '../../lib/track-sort';

export type TrackSortContext = 'playlist' | 'likes';

const SORT_ICONS: Record<TrackSort, React.ReactNode> = {
  default: <ListMusic size={13} />,
  reverse: <ArrowUpDown size={13} />,
  released: <Calendar size={13} />,
  plays: <Headphones size={13} />,
  likes: <Heart size={13} />,
  reposts: <Repeat2 size={13} />,
  title: <ArrowDownAZ size={13} />,
  artist: <User size={13} />,
  duration: <Clock size={13} />,
};

const DIVIDER_BEFORE: TrackSort[] = ['released', 'title'];

function trackSortLabelKey(sort: TrackSort, context: TrackSortContext): string {
  if (sort === 'default' || sort === 'reverse') return `trackSort.${context}_${sort}`;
  return `trackSort.${sort}`;
}

export const TrackSortMenu = React.memo(function TrackSortMenu({
  sort,
  context,
  loading,
  onSort,
  onReset,
}: {
  sort: TrackSort;
  context: TrackSortContext;
  loading?: boolean;
  onSort: (sort: TrackSort) => void;
  onReset?: () => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [open, setOpen] = useState(false);
  const b = perf.blur(30);
  const active = sort !== 'default';

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={t('trackSort.label')}
          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] border px-3 text-[11.5px] font-semibold transition-all duration-200 ease-[var(--ease-apple)] ${
            active
              ? 'border-accent/25 bg-accent/10 text-accent'
              : open
                ? 'border-ink/[0.14] bg-ink/[0.06] text-ink-85'
                : 'border-ink/[0.07] bg-ink/[0.03] text-ink-50 hover:border-ink/[0.14] hover:text-ink-85'
          }`}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : SORT_ICONS[sort]}
          <span>{t(trackSortLabelKey(sort, context))}</span>
          <ChevronDown size={11} className="opacity-60" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-[230px] rounded-2xl p-1.5 outline-none animate-fade-in"
          style={{
            background: b > 0 ? 'rgb(var(--surface) / 0.88)' : 'rgb(var(--surface-hi))',
            backdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            border: '1px solid rgb(var(--ink) / 0.08)',
            boxShadow: '0 20px 60px rgb(var(--shade) / calc(0.5 * var(--shade-alpha)))',
          }}
        >
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-35">
            {t('trackSort.label')}
          </p>
          {TRACK_SORTS.map((mode) => (
            <React.Fragment key={mode}>
              {DIVIDER_BEFORE.includes(mode) && (
                <div className="mx-2 my-1 h-px bg-ink/[0.06]" aria-hidden />
              )}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSort(mode);
                }}
                className={`group flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                  sort === mode
                    ? 'bg-ink/[0.07] text-ink-92'
                    : 'text-ink-60 hover:bg-ink/[0.05] hover:text-ink-90'
                }`}
              >
                <span
                  className={`transition-colors ${
                    sort === mode ? 'text-accent' : 'text-ink-35 group-hover:text-accent'
                  }`}
                >
                  {SORT_ICONS[mode]}
                </span>
                <span className="flex-1">{t(trackSortLabelKey(mode, context))}</span>
                {sort === mode && <Check size={12} className="text-accent" />}
              </button>
            </React.Fragment>
          ))}
          {onReset && (
            <>
              <div className="mx-2 my-1 h-px bg-ink/[0.06]" aria-hidden />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReset();
                }}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium text-ink-60 transition-colors hover:bg-ink/[0.05] hover:text-ink-90"
              >
                <span className="text-ink-35 transition-colors group-hover:text-accent">
                  <RotateCcw size={13} />
                </span>
                <span className="flex-1">{t('trackSort.resetOrder')}</span>
              </button>
            </>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
