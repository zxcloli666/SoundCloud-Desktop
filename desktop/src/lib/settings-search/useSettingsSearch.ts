import i18next from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { categories, entries } from 'virtual:settings-index';
import { buildDocs } from './docs';
import { buildSearchIndex, search } from './search-index';
import { lookupText, plainText } from './texts';
import type { FieldKind, SettingsEntry } from './types';

type Phrases = Record<string, string[]>;

export interface SettingsResult {
  id: string;
  kind: SettingsEntry['kind'] | 'section';
  category: string;
  title: string;
  path: string;
  desc: string;
  descMatched: boolean;
  titles: string[];
  cardTitles: string[];
}

const LIMIT = 20;
const SECTION_LIMIT = 2;
const phraseLoaders = import.meta.glob<Phrases>('../../i18n/search/*.json', { import: 'default' });
const phraseCache = new Map<string, Promise<Phrases>>();

function loadPhrases(language: string): Promise<Phrases> {
  const cached = phraseCache.get(language);
  if (cached) return cached;
  const load = phraseLoaders[`../../i18n/search/${language}.json`];
  const loaded = load ? load().catch(() => ({})) : Promise.resolve({});
  phraseCache.set(language, loaded);
  return loaded;
}

function textIn(language: string, key: string): string {
  return plainText(lookupText((name) => i18next.getResource(language, 'translation', name), key));
}

function textsOf(language: string, keys: string[]): string[] {
  return keys.map((key) => textIn(language, key)).filter((text) => text !== '');
}

export function useSettingsSearch(
  query: string,
  visible: string[],
): { results: SettingsResult[]; ready: boolean } {
  const { i18n } = useTranslation();
  const language = i18n.language.split('-')[0];
  const [loaded, setLoaded] = useState<{ language: string; files: Phrases[] } | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([loadPhrases('en'), loadPhrases(language)]).then((files) => {
      if (live) setLoaded({ language, files });
    });
    return () => {
      live = false;
    };
  }, [language]);

  const visibleKey = visible.join();
  const files = loaded?.language === language ? loaded.files : null;

  const built = useMemo(() => {
    if (!files) return null;
    const shown = new Set(visibleKey.split(','));
    const list = entries.filter((entry) => shown.has(entry.category));
    const shownCategories = categories.filter((item) => shown.has(item.id));
    const codes = [...new Set([language, 'en'])];
    const texts = (key: string) =>
      [...new Set(codes.map((code) => textIn(code, key)))].filter(Boolean);
    const labels = (category: string) => {
      const info = categories.find((item) => item.id === category);
      return info ? texts(info.labelKey) : [];
    };
    const sectionDocs = shownCategories.map((item) => ({
      id: item.id,
      fields: texts(item.labelKey).map((text) => ({ kind: 'title' as const, text })),
    }));
    return {
      index: buildSearchIndex(buildDocs(list, texts, files, labels)),
      sections: buildSearchIndex(sectionDocs),
      byId: new Map(list.map((entry) => [entry.id, entry])),
    };
  }, [language, visibleKey, files]);

  const results = useMemo(() => {
    if (!built || query.trim() === '') return [];
    const sections = search(built.sections, query, SECTION_LIMIT).map((hit) =>
      toSection(hit.id, language),
    );
    const settings = search(built.index, query, LIMIT).flatMap((hit) => {
      const entry = built.byId.get(hit.id);
      return entry ? [toResult(entry, hit.kind, hit.text, built.byId, language)] : [];
    });
    return [...sections, ...settings];
  }, [query, built, language]);

  return { results, ready: built !== null };
}

function toSection(category: string, language: string): SettingsResult {
  const key = categories.find((item) => item.id === category)?.labelKey ?? '';
  const title = textIn(language, key) || textIn('en', key);
  return {
    id: `section:${category}`,
    kind: 'section',
    category,
    title,
    path: '',
    desc: '',
    descMatched: false,
    titles: [title],
    cardTitles: [],
  };
}

function toResult(
  entry: SettingsEntry,
  kind: FieldKind,
  hitText: string,
  byId: Map<string, SettingsEntry>,
  language: string,
): SettingsResult {
  const ui = (keys: string[]) => {
    const own = textsOf(language, keys);
    return own.length > 0 ? own : textsOf('en', keys);
  };
  const titles = ui(entry.title);
  const host = entry.kind === 'row' ? byId.get(entry.card) : undefined;
  const cardTitles = host ? ui(host.title) : [];
  const label =
    ui([categories.find((item) => item.id === entry.category)?.labelKey ?? ''])[0] ?? '';
  const descMatched = kind === 'desc' || kind === 'option';
  return {
    id: entry.id,
    kind: entry.kind,
    category: entry.category,
    title: titles[0] ?? '',
    path: cardTitles[0] ? `${label} › ${cardTitles[0]}` : label,
    desc: descMatched ? hitText : (ui(entry.desc)[0] ?? ''),
    descMatched,
    titles,
    cardTitles,
  };
}
