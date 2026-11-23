import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface PrismSegment {
  genre: string;
  share: number;
  color: string;
}

interface PrismBandProps {
  segments: PrismSegment[];
  active: string;
  onSelect: (genre: string) => void;
}

export const PrismBand = memo(function PrismBand({ segments, active, onSelect }: PrismBandProps) {
  const { t } = useTranslation();
  const btns = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let ni = i;
    if (e.key === 'ArrowRight') ni = Math.min(i + 1, segments.length - 1);
    else if (e.key === 'ArrowLeft') ni = Math.max(i - 1, 0);
    else if (e.key === 'Home') ni = 0;
    else if (e.key === 'End') ni = segments.length - 1;
    else return;
    e.preventDefault();
    onSelect(segments[ni].genre);
    btns.current[ni]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={t('discover.prismGenresLabel')}
      className="flex w-full gap-1 select-none"
    >
      {segments.map((s, i) => {
        const isActive = s.genre === active;
        return (
          <button
            key={s.genre}
            type="button"
            ref={(el) => {
              btns.current[i] = el;
            }}
            role="radio"
            aria-checked={isActive}
            aria-label={s.genre}
            tabIndex={isActive ? 0 : -1}
            title={s.genre}
            onClick={() => onSelect(s.genre)}
            onKeyDown={(e) => onKey(e, i)}
            className="group/seg flex min-w-[52px] cursor-pointer flex-col gap-2 rounded-lg pt-1 text-left"
            style={{ flexGrow: Math.max(s.share, 0.04), flexBasis: 0 }}
          >
            <span
              className="h-1.5 w-full rounded-full transition-opacity duration-300"
              style={{ background: s.color, opacity: isActive ? 1 : 0.35 }}
            />
            <span className="flex min-w-0 items-baseline gap-1.5 px-0.5">
              <span
                className={`truncate text-[11.5px] capitalize transition-colors ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink-45 group-hover/seg:text-ink-80'}`}
              >
                {s.genre}
              </span>
              {isActive && (
                <span className="text-[10px] tabular-nums text-ink-40">
                  {Math.round(s.share * 100)}%
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
});
