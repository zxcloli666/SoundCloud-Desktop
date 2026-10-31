import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Search, X } from '../../lib/icons';

export const SequenceFilter = React.memo(function SequenceFilter({
  value,
  loading,
  onChange,
}: {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const active = value !== '';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyF' || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      className={`relative flex h-8 items-center rounded-[10px] border transition-all duration-300 ease-[var(--ease-apple)] focus-within:w-[240px] focus-within:border-ink/[0.16] focus-within:bg-ink/[0.06] ${
        active
          ? 'w-[240px] border-ink/[0.14] bg-ink/[0.05]'
          : 'w-[168px] border-ink/[0.07] bg-ink/[0.03] hover:border-ink/[0.12]'
      }`}
    >
      <span
        className={`pointer-events-none absolute left-2.5 flex items-center ${active ? 'text-accent' : 'text-ink-35'}`}
      >
        {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
      </span>
      <input
        ref={inputRef}
        type="text"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return;
          e.stopPropagation();
          if (active) onChange('');
          else e.currentTarget.blur();
        }}
        placeholder={t('playlist.find')}
        aria-label={t('playlist.find')}
        className="h-full w-full bg-transparent pl-8 pr-7 text-[12px] font-medium text-ink-85 outline-none placeholder:text-ink-30"
      />
      {active && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label={t('playlist.findClear')}
          title={t('playlist.findClear')}
          className="absolute right-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-ink-35 transition-colors hover:bg-ink/[0.08] hover:text-ink-80"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
});
