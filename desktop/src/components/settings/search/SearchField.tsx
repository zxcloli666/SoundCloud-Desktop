import { type KeyboardEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from '../../../lib/icons';

export function SearchField({
  value,
  onChange,
  onFocus,
  onKeyDown,
  onClear,
  listId,
  activeId,
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
  listId: string;
  activeId: string | undefined;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (event.code !== 'KeyF' || !(event.ctrlKey || event.metaKey)) return;
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
      onFocus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onFocus]);

  return (
    <div
      data-ui="settings-search"
      className="relative mb-2.5 flex h-11 items-center rounded-2xl border-[0.5px] border-ink/[0.08] bg-ink/[0.03] transition-[background-color,border-color,box-shadow] duration-200 focus-within:border-ink/[0.18] focus-within:bg-ink/[0.05] focus-within:shadow-[0_0_18px_var(--color-accent-glow)]"
    >
      <span className="pointer-events-none absolute left-3.5 text-ink-40">
        <Search size={15} />
      </span>
      <input
        ref={input}
        type="text"
        role="combobox"
        aria-expanded={value.trim() !== ''}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-label={t('settings.search')}
        placeholder={t('settings.search')}
        value={value}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        className="h-full min-w-0 flex-1 bg-transparent pl-10 pr-9 text-[13.5px] font-medium text-ink outline-none placeholder:text-ink-35"
      />
      {value !== '' && (
        <button
          type="button"
          data-ui="settings-search-clear"
          aria-label={t('settings.searchClear')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onClear();
            input.current?.focus();
          }}
          className="absolute right-2 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink-40 transition-colors duration-200 hover:bg-ink/[0.08] hover:text-ink-85"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
