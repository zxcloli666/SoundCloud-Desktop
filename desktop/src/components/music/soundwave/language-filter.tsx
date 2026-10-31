import * as Popover from '@radix-ui/react-popover';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Globe, X } from '../../../lib/icons';

const LANGUAGES: Array<{ code: string; name: string }> = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'uk', name: 'Українська' },
];

interface Props {
  selected: string[];
  onChange: (langs: string[]) => void;
}

export const LanguageFilter = React.memo(function LanguageFilter({ selected, onChange }: Props) {
  const { t } = useTranslation();
  const count = selected.length;

  const toggle = (code: string) => {
    if (selected.includes(code)) onChange(selected.filter((c) => c !== code));
    else onChange([...selected, code]);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-ink/[0.06] border border-ink/[0.08] hover:bg-ink/[0.1] hover:border-ink/[0.14] transition-colors duration-200 text-[11px] font-medium text-ink-70 hover:text-ink-95 cursor-pointer"
          title={t('soundwave.languages')}
        >
          <Globe size={12} />
          <span className="tabular-nums">
            {count === 0 ? t('soundwave.allLanguages') : `${count} ${t('soundwave.langShort')}`}
          </span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-[240px] p-2 rounded-2xl outline-none"
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
              {t('soundwave.languages')}
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
          <div className="max-h-[260px] overflow-y-auto scrollbar-hide mt-1">
            {LANGUAGES.map((l) => {
              const active = selected.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => toggle(l.code)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-[12px] transition-colors duration-150 cursor-pointer ${
                    active
                      ? 'text-ink'
                      : 'text-ink-65 hover:bg-ink/[0.05] hover:text-ink-90'
                  }`}
                  style={active ? { background: 'var(--color-accent-glow)' } : undefined}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-semibold tabular-nums text-ink-40">
                      {l.code}
                    </span>
                    {l.name}
                  </span>
                  {active && <Check size={12} style={{ color: 'var(--color-accent)' }} />}
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
