import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES_GUIDE_URL } from '../../../lib/constants';
import { BookOpen, Palette, RefreshCw, Search } from '../../../lib/icons';
import { activeLook, activeTheme } from '../../../lib/themes/records';
import { useSettingsStore } from '../../../stores/settings';
import { useThemesStore } from '../../../stores/themes';
import { Skeleton } from '../../ui/Skeleton';
import { Card, Toggle } from '../primitives';
import { ThemeDetails } from './ThemeDetails';
import { type ThemeItem, ThemeSwatch, ThemeTile } from './ThemeTile';

const SEARCH_FROM = 12;
const STALE_MS = 10 * 60 * 1000;
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3';

function NoThemeTile({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const accent = useSettingsStore((s) => s.accentColor);
  const bg = useSettingsStore((s) => s.bgPrimary);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
        active ? 'border-[var(--color-accent)]' : 'border-ink/[0.06] hover:border-ink/15'
      }`}
      style={active ? { boxShadow: '0 0 0 1px var(--color-accent)' } : undefined}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <ThemeSwatch accent={accent} background={bg} />
      </div>
      <div className="px-3 py-2 bg-ink/[0.03] text-[12.5px] font-semibold text-ink-75 truncate">
        {t('settings.themesNone')}
      </div>
    </button>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink/[0.06] bg-ink/[0.03] px-4 py-3">
      <span className="text-[12.5px] text-ink-50">{t('settings.themesOffline')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-ink/[0.06] px-3 py-1.5 text-[12px] font-semibold text-ink-75 hover:bg-ink/[0.1] transition-all cursor-pointer"
      >
        {t('settings.themesRetry')}
      </button>
    </div>
  );
}

export function ThemesCard() {
  const { t, i18n } = useTranslation();
  const catalog = useThemesStore((s) => s.catalog);
  const installed = useThemesStore((s) => s.installed);
  const status = useThemesStore((s) => s.status);
  const enabled = useThemesStore((s) => s.enabled);
  const autoUpdate = useThemesStore((s) => s.autoUpdate);
  const busy = useThemesStore((s) => s.busy);
  const plain = useThemesStore((s) => activeLook(s) === null);
  const activeId = useThemesStore((s) => (activeTheme(s) ? s.activeId : null));
  const { refresh, setEnabled, setAutoUpdate, deactivate } = useThemesStore.getState();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const state = useThemesStore.getState();
    if (!state.catalog || Date.now() - state.checkedAt > STALE_MS) void state.refresh(false);
  }, []);

  const items = useMemo(() => {
    const list: ThemeItem[] = (catalog?.themes ?? []).map((entry) => ({
      id: entry.id,
      entry,
      installed: installed[entry.id] ?? null,
    }));
    for (const [id, theme] of Object.entries(installed)) {
      if (!list.some((item) => item.id === id)) list.push({ id, entry: null, installed: theme });
    }
    const rank = (item: ThemeItem) => (item.id === activeId ? 0 : item.installed ? 1 : 2);
    const updated = (item: ThemeItem) => item.entry?.updated ?? '';
    return list.sort((a, b) => rank(a) - rank(b) || updated(b).localeCompare(updated(a)));
  }, [catalog, installed, activeId]);

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? items.filter((item) =>
        [item.entry?.name ?? item.installed?.name, item.entry?.author.name]
          .concat(Object.values(item.entry?.description ?? {}))
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
    : items;
  const openItem = items.find((item) => item.id === openId) ?? null;
  const loading = status === 'loading' && !catalog;
  const guide = `${THEMES_GUIDE_URL}/${i18n.language.startsWith('ru') ? 'README.ru.md' : 'README.md'}`;

  return (
    <Card
      title={t('settings.themesTitle')}
      icon={<Palette size={17} />}
      action={
        <Toggle
          checked={enabled}
          onChange={() => void setEnabled(!enabled)}
          label={t('settings.themesTitle')}
        />
      }
    >
      <div className="space-y-4">
        {items.length > SEARCH_FROM && (
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-30"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('settings.themesSearch')}
              spellCheck={false}
              className="w-full rounded-xl border border-ink/[0.06] bg-ink/[0.04] py-2.5 pl-10 pr-4 text-[13px] text-ink-80 placeholder:text-ink-25 outline-none transition-all focus:border-ink/[0.12] focus:bg-ink/[0.06]"
            />
          </div>
        )}
        {status === 'error' && <ErrorState onRetry={() => void refresh(true)} />}
        <div className={GRID}>
          {!needle && <NoThemeTile active={plain} onSelect={deactivate} />}
          {loading &&
            [0, 1, 2].map((key) => (
              <Skeleton key={key} rounded="lg" className="aspect-[16/12] w-full" />
            ))}
          {shown.map((item) => (
            <ThemeTile
              key={item.id}
              item={item}
              active={item.id === activeId}
              busy={busy === item.id}
              onOpen={setOpenId}
            />
          ))}
        </div>
        {catalog && shown.length === 0 && (
          <p className="text-center text-[12px] text-ink-35">
            {t(needle ? 'settings.themesNotFound' : 'settings.themesEmpty')}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/[0.05] pt-4">
          <label className="inline-flex items-center gap-3 text-[12.5px] text-ink-60">
            <Toggle
              checked={autoUpdate}
              onChange={() => setAutoUpdate(!autoUpdate)}
              label={t('settings.themesAutoUpdate')}
            />
            {t('settings.themesAutoUpdate')}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={status === 'loading'}
              title={t('settings.themesRefresh')}
              aria-label={t('settings.themesRefresh')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-45 hover:bg-ink/[0.08] hover:text-ink-85 transition-all cursor-pointer disabled:cursor-default"
            >
              <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              onClick={() => openUrl(guide)}
              className="flex items-center gap-2 rounded-xl border border-ink/[0.06] bg-ink/[0.06] px-4 py-2 text-[12px] font-semibold text-ink-75 hover:bg-ink/[0.1] hover:text-ink transition-all cursor-pointer"
            >
              <BookOpen size={12} />
              {t('settings.themesMake')}
            </button>
          </div>
        </div>
      </div>
      <ThemeDetails item={openItem} onClose={() => setOpenId(null)} />
    </Card>
  );
}
