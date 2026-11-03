import * as Popover from '@radix-ui/react-popover';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Check, ChevronDown, playWhite12, Search, Shuffle, X} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import type {OfflineSection, SortMode} from './types';

const SORT_MODES: SortMode[] = ['custom', 'recent', 'title', 'artist', 'duration', 'size'];

function sortLabelKey(mode: SortMode, section: OfflineSection): string {
  if (mode === 'custom') {
    if (section === 'likes') return 'offline.sortLiked';
    return section === 'playlists' ? 'offline.sortPlaylist' : 'offline.sortCustom';
  }
  return `offline.sort_${mode}`;
}

const SortMenu = React.memo(function SortMenu({
  section,
  sort,
  onSort,
}: {
  section: OfflineSection;
  sort: SortMode;
  onSort: (mode: SortMode) => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const [open, setOpen] = useState(false);
  const b = perf.blur(30);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="flex h-9 cursor-pointer items-center gap-2 rounded-[11px] border border-ink/[0.08] bg-ink/[0.03] px-3.5 text-[12px] font-medium text-ink-55 transition-colors hover:border-ink/[0.14] hover:text-ink-85"
        >
          {t('offline.sortLabel')} ·{' '}
          <span className="text-ink-85">{t(sortLabelKey(sort, section))}</span>
          <ChevronDown size={11} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={8}
          align="end"
          className="z-50 w-[200px] rounded-2xl p-1.5 outline-none"
          style={{
            background: b > 0 ? 'rgb(var(--surface) / 0.88)' : 'rgb(var(--surface-hi))',
            backdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(1.8)` : undefined,
            border: '1px solid rgb(var(--ink) / 0.08)',
            boxShadow: '0 20px 60px rgb(var(--shade) / calc(0.5 * var(--shade-alpha)))',
          }}
        >
          {SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                onSort(mode);
                setOpen(false);
              }}
              className={`flex w-full cursor-pointer items-center justify-between rounded-[10px] px-3 py-2 text-left text-[12.5px] font-medium transition-colors ${
                sort === mode
                  ? 'bg-ink/[0.07] text-ink-92'
                  : 'text-ink-55 hover:bg-ink/[0.05] hover:text-ink-85'
              }`}
            >
              {t(sortLabelKey(mode, section))}
              {sort === mode && <Check size={12} style={{ color: 'var(--color-accent)' }} />}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});

/** Тулбар: коллекции, транспорт, поиск, сортировка. */
export const OfflineToolbar = React.memo(function OfflineToolbar({
  section,
  onSection,
  likesCount,
  cachedCount,
  playlistsCount,
  localCount,
  playableCount,
  onPlayAll,
  onShuffle,
  query,
  onQuery,
  sort,
  onSort,
}: {
  section: OfflineSection;
  onSection: (s: OfflineSection) => void;
  likesCount: number;
  cachedCount: number;
  playlistsCount: number;
  localCount: number;
  playableCount: number;
  onPlayAll: () => void;
  onShuffle: () => void;
  query: string;
  onQuery: (q: string) => void;
  sort: SortMode;
  onSort: (mode: SortMode) => void;
}) {
  const { t } = useTranslation();

  const tab = (key: OfflineSection, label: string, count: number) => (
    <button
      type="button"
      onClick={() => onSection(key)}
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-[7px] text-[12.5px] font-medium transition-colors ${
        section === key
          ? 'bg-ink/[0.08] text-ink-92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
          : 'text-ink-50 hover:text-ink-80'
      }`}
    >
      {label}
      <span className="font-mono text-[10.5px] font-medium text-ink-35 tabular-nums">
        {count}
      </span>
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <div className="flex gap-0.5 rounded-[11px] border border-ink/[0.08] bg-ink/[0.02] p-[3px]">
        {tab('likes', t('offline.likesTitle'), likesCount)}
        {tab('playlists', t('offline.playlistsTitle'), playlistsCount)}
        {tab('cached', t('offline.cachedTitle'), cachedCount)}
        {tab('local', t('local.tab'), localCount)}
      </div>

      <button
        type="button"
        onClick={onPlayAll}
        disabled={playableCount === 0}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-[11px] bg-accent px-4 text-[12.5px] font-semibold text-accent-contrast shadow-[0_6px_22px_-8px_var(--color-accent-glow),inset_0_1px_0_rgba(255,255,255,0.25)] transition-transform hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-35"
      >
        {playWhite12}
        {t('offline.playAll')}
      </button>
      <button
        type="button"
        onClick={onShuffle}
        disabled={playableCount === 0}
        className="flex h-9 cursor-pointer items-center gap-2 rounded-[11px] border border-ink/[0.08] bg-ink/[0.03] px-4 text-[12.5px] font-semibold text-ink-60 transition-colors hover:border-ink/[0.14] hover:text-ink-90 disabled:cursor-not-allowed disabled:opacity-35"
      >
        <Shuffle size={13} />
        {t('offline.shuffle')}
      </button>

      <div className="flex-1" />

      <label className="flex h-9 w-[220px] items-center gap-2 rounded-[11px] border border-ink/[0.08] bg-ink/[0.03] px-3 text-ink-35 transition-colors focus-within:border-ink/[0.16] focus-within:text-ink-55">
        <Search size={13} strokeWidth={1.8} />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t('offline.searchPlaceholder')}
          aria-label={t('offline.searchPlaceholder')}
          className="w-full bg-transparent text-[12.5px] font-medium text-ink-90 placeholder:text-ink-30 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery('')}
            aria-label="clear"
            className="flex size-5 flex-none cursor-pointer items-center justify-center rounded-full text-ink-40 hover:bg-ink/[0.08] hover:text-ink-80"
          >
            <X size={11} strokeWidth={2.2} />
          </button>
        )}
      </label>

      <SortMenu section={section} sort={sort} onSort={onSort} />
    </div>
  );
});
