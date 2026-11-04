import { type KeyboardEvent, memo, type Ref, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../../lib/icons';
import { usePerfMode } from '../../../../lib/perf';
import { ArtImage } from './ArtImage';
import { coverSrc } from './perks';
import type { ArtworkChoice } from './useArtworkChoices';

const COLUMNS = 4;

const STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: COLUMNS,
  ArrowUp: -COLUMNS,
};

function nextIndex(key: string, from: number, count: number): number | null {
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = STEP[key];
  if (step === undefined) return null;
  const to = from + step;
  return to < 0 || to >= count ? from : to;
}

export const CoverGrid = memo(function CoverGrid({
  choices,
  selected,
  accent,
  ink,
  onSelect,
  gridRef,
}: {
  choices: ArtworkChoice[];
  selected: string | null;
  accent: string;
  ink: string;
  onSelect: (url: string) => void;
  gridRef?: Ref<HTMLDivElement>;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = choices.findIndex((choice) => choice.url === selected);
  const [focus, setFocus] = useState(-1);
  const active = focus >= 0 && focus < choices.length ? focus : Math.max(0, selectedIndex);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const to = nextIndex(event.key, active, choices.length);
    if (to === null) return;
    event.preventDefault();
    setFocus(to);
    tiles.current[to]?.focus();
  };

  return (
    <div
      ref={gridRef}
      role="radiogroup"
      aria-label={t('chat.room.perks.cover.title')}
      onKeyDown={onKeyDown}
      className="grid max-h-[212px] grid-cols-4 gap-2 overflow-y-auto p-1.5 [scrollbar-width:thin]"
    >
      {choices.map((choice, index) => {
        const on = choice.url === selected;
        return (
          <button
            key={choice.url}
            ref={(node) => {
              tiles.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={choice.label || t(`chat.room.perks.cover.kind.${choice.kind}`)}
            title={choice.label || undefined}
            tabIndex={index === active ? 0 : -1}
            onFocus={() => setFocus(index)}
            onClick={() => onSelect(choice.url)}
            className={`perk-motion relative aspect-square cursor-pointer overflow-hidden bg-ink/[0.06] outline-none transition-transform duration-200 hover:scale-[1.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              choice.kind === 'avatar' ? 'rounded-full' : 'rounded-[10px]'
            }`}
            style={{
              animation:
                perf.mode === 'light'
                  ? undefined
                  : `perk-tile-in 0.36s var(--ease-apple) ${Math.min(index, 16) * 18}ms both`,
              boxShadow: on ? `0 0 0 2px rgb(var(--surface)), 0 0 0 4px ${accent}` : undefined,
            }}
          >
            <ArtImage
              src={coverSrc(choice.url)}
              seed={choice.url}
              className="h-full w-full object-cover"
            />
            {on && (
              <span
                data-scheme="dark"
                className="absolute inset-0 flex items-center justify-center bg-shade-30"
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full"
                  style={{ background: accent, color: ink }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
});
