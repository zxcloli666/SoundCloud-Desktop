import { memo, type ReactNode, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { revealChip, useChipScroller } from './useChipScroller';
import './chips.css';

const PAGE_SHARE = 0.7;

function EdgeButton({
  side,
  label,
  onClick,
}: {
  side: 'prev' | 'next';
  label: string;
  onClick: () => void;
}) {
  const Icon = side === 'prev' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`chat-chips-${side} absolute top-1/2 size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-ink-60 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-white ${
        side === 'prev' ? 'left-0' : 'right-0'
      }`}
    >
      <Icon size={15} />
    </button>
  );
}

export const ChipScroller = memo(function ChipScroller({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const smooth = usePerfMode().mode !== 'light';
  const rowRef = useRef<HTMLDivElement>(null);
  useChipScroller(rowRef);

  useEffect(() => {
    if (active) revealChip(rowRef.current, smooth);
  }, [active, smooth]);

  const page = (direction: number) => {
    const row = rowRef.current;
    if (!row) return;
    const left = direction * row.clientWidth * PAGE_SHARE;
    row.scrollBy({ left, behavior: smooth ? 'smooth' : 'instant' });
  };

  return (
    <div className="relative flex min-w-0 flex-1">
      <div
        ref={rowRef}
        className="chat-chips scrollbar-hide relative flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
      >
        {children}
      </div>
      <EdgeButton side="prev" label={t('chat.list.filters.back')} onClick={() => page(-1)} />
      <EdgeButton side="next" label={t('chat.list.filters.more')} onClick={() => page(1)} />
    </div>
  );
});
