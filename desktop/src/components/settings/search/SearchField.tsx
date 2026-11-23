import { type KeyboardEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from '../../../lib/icons';
import { isMac } from '../../../lib/platform';

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
      className="group/search relative flex h-9 items-center rounded-[10px] border border-[color:var(--shell-line-hi)] bg-[var(--shell-fill)] transition-colors duration-150 hover:bg-[var(--shell-fill-hi)] focus-within:border-accent focus-within:bg-[var(--shell-fill)]"
    >
      <span className="pointer-events-none absolute left-3 text-ink-40">
        <Search size={14} />
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
        className="h-full min-w-0 flex-1 bg-transparent pl-9 pr-9 text-[13px] text-ink-90 outline-none placeholder:text-ink-35 select-text"
      />
      {value !== '' ? (
        <button
          type="button"
          data-ui="settings-search-clear"
          aria-label={t('settings.searchClear')}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onClear();
            input.current?.focus();
          }}
          className="absolute right-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-ink-40 transition-colors duration-150 hover:bg-ink/[0.08] hover:text-ink-85"
        >
          <X size={13} />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-1.5 flex h-6 items-center rounded-md border border-ink/10 bg-ink/[0.05] px-1.5 text-[10px] font-semibold tracking-wide text-ink-30 transition-opacity duration-150 group-focus-within/search:opacity-0">
          {isMac() ? '⌘' : 'Ctrl'} F
        </kbd>
      )}
    </div>
  );
}
