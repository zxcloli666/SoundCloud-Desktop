import * as Popover from '@radix-ui/react-popover';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Disc3, X } from '../../../lib/icons';
import { GENRES } from '../../search/utils';

interface Props {
  selected: string[];
  onChange: (genres: string[]) => void;
}

export const GenreFilter = React.memo(function GenreFilter({ selected, onChange }: Props) {
  const { t } = useTranslation();
  const count = selected.length;
  const picked = GENRES.filter((g) => selected.includes(g.key));

  const toggle = (key: string) => {
    if (selected.includes(key)) onChange(selected.filter((k) => k !== key));
    else onChange([...selected, key]);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-ink/[0.06] border border-ink/[0.08] hover:bg-ink/[0.1] hover:border-ink/[0.14] transition-colors duration-200 text-[11px] font-medium text-ink-70 hover:text-ink-95 cursor-pointer"
          title={t('soundwave.genres')}
        >
          <Disc3 size={12} />
          {count === 0 ? (
            <span>{t('soundwave.allGenres')}</span>
          ) : (
            <>
              <span className="flex -space-x-1">
                {picked.slice(0, 3).map((g) => (
                  <span
                    key={g.key}
                    className="size-2.5 rounded-full ring-1 ring-surface"
                    style={{ background: g.color }}
                  />
                ))}
              </span>
              <span className="tabular-nums">{count}</span>
            </>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-[260px] p-2 rounded-2xl outline-none"
          style={{
            background: 'rgb(var(--surface) / 0.88)',
            backdropFilter: 'blur(30px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.8)',
            border: '1px solid rgb(var(--ink) / 0.08)',
            boxShadow: '0 20px 60px rgb(var(--shade) / calc(0.5 * var(--shade-alpha)))',
          }}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[11px] font-semibold text-ink-60 uppercase tracking-wider">
              {t('soundwave.genres')}
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[10px] text-ink-40 hover:text-ink-80 transition-colors cursor-pointer flex items-center gap-0.5"
              >
                <X size={10} />
                {t('soundwave.clear')}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 px-1.5 pb-1.5 pt-1">
            {GENRES.map((g) => {
              const active = selected.includes(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(g.key)}
                  className={`flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] border transition-colors duration-150 cursor-pointer ${
                    active
                      ? 'text-ink border-transparent'
                      : 'text-ink-65 border-ink/[0.1] hover:bg-ink/[0.05] hover:text-ink-90'
                  }`}
                  style={
                    active
                      ? { background: `color-mix(in srgb, ${g.color} 28%, transparent)` }
                      : undefined
                  }
                >
                  <span className="size-2 rounded-full" style={{ background: g.color }} />
                  {g.label}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
