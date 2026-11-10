import { type KeyboardEvent, useCallback, useState } from 'react';
import {
  type SettingsResult,
  useSettingsSearch,
} from '../../../lib/settings-search/useSettingsSearch';
import { cancelReveal, revealResult } from './reveal';
import { rowId } from './SearchResults';

export function useSettingsSearchView(categories: string[], openCategory: (id: string) => void) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const { results, ready } = useSettingsSearch(query, categories);
  const filled = query.trim() !== '';
  const shown = open && filled && ready;
  const active = Math.min(cursor, Math.max(results.length - 1, 0));

  const edit = (value: string) => {
    setQuery(value);
    setOpen(true);
    setCursor(0);
  };

  const clear = () => {
    setQuery('');
    setOpen(false);
    setCursor(0);
  };

  const reopen = useCallback(() => {
    if (filled) setOpen(true);
  }, [filled]);

  const choose = (result: SettingsResult) => {
    setOpen(false);
    openCategory(result.category);
    if (result.kind === 'section') cancelReveal();
    else void revealResult(result);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      clear();
      event.currentTarget.blur();
      return;
    }
    if (!filled) return;
    if (!shown) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (results.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setCursor((active + step + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      choose(results[active]);
    }
  };

  return {
    query,
    results,
    settingsCount: results.filter((result) => result.kind !== 'section').length,
    shown,
    active,
    activeId: shown && results.length > 0 ? rowId(active) : undefined,
    edit,
    clear,
    reopen,
    choose,
    setCursor,
    onKeyDown,
  };
}
