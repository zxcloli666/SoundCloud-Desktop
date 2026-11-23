import { openUrl } from '@tauri-apps/plugin-opener';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { THEMES_GUIDE_URL } from '../../../lib/constants';
import { BookOpen, Palette, RefreshCw, Search } from '../../../lib/icons';
import { activeLook, activeTheme } from '../../../lib/themes/records';
import { useSettingsStore } from '../../../stores/settings';
import { useThemesStore } from '../../../stores/themes';
import { Skeleton } from '../../ui/Skeleton';
import { Card, Row, Toggle } from '../primitives';
import { ThemeDetails } from './ThemeDetails';
import { type ThemeItem, ThemeSwatch, ThemeTile } from './ThemeTile';

const SEARCH_FROM = 12;
const STALE_MS = 10 * 60 * 1000;
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5';

function NoThemeTile({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  const { t } = useTranslation();
  const accent = useSettingsStore((s) => s.accentColor);
  const bg = useSettingsStore((s) => s.bgPrimary);
  return (
    <button type="button" onClick={onSelect} data-active={active} className="set-tile">
      <span className="set-tile-art aspect-[16/10] w-full">
        <ThemeSwatch accent={accent} background={bg} />
      </span>
      <span className="set-tile-label">{t('settings.themesNone')}</span>
    </button>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-[var(--set-well)] py-1.5 pr-1.5 pl-3">
      <span className="min-w-0 flex-1 text-[12.5px] text-ink-60">
        {t('settings.themesOffline')}
      </span>
      <button type="button" onClick={onRetry} className="set-btn h-7">
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
        <>
          <button
            type="button"
            onClick={() => void refresh(true)}
            disabled={status === 'loading'}
            title={t('settings.themesRefresh')}
            aria-label={t('settings.themesRefresh')}
            className="set-btn w-8 px-0"
            data-tone="quiet"
          >
            <RefreshCw size={14} className={status === 'loading' ? 'animate-spin' : ''} />
          </button>
          <Toggle
            checked={enabled}
            onChange={() => void setEnabled(!enabled)}
            label={t('settings.themesTitle')}
          />
        </>
      }
    >
      {items.length > SEARCH_FROM && (
        <div className="relative">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-35" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('settings.themesSearch')}
            spellCheck={false}
            className="h-9 w-full rounded-[10px] border border-[color:var(--set-line)] bg-[var(--set-well)] pr-3 pl-9 text-[13px] text-ink-90 outline-none transition-colors duration-150 placeholder:text-ink-35 focus:border-accent"
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
        <p className="text-center text-[12px] text-ink-40">
          {t(needle ? 'settings.themesNotFound' : 'settings.themesEmpty')}
        </p>
      )}
      <Row title={t('settings.themesAutoUpdate')}>
        <Toggle
          checked={autoUpdate}
          onChange={() => setAutoUpdate(!autoUpdate)}
          label={t('settings.themesAutoUpdate')}
        />
      </Row>
      <button
        type="button"
        onClick={() => openUrl(guide)}
        className="flex w-fit cursor-pointer items-center gap-1.5 text-[12px] text-ink-45 transition-colors duration-150 hover:text-ink"
      >
        <BookOpen size={12} />
        {t('settings.themesMake')}
      </button>
      <ThemeDetails item={openItem} onClose={() => setOpenId(null)} />
    </Card>
  );
}
