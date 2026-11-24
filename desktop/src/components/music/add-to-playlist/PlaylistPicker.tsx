import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMyPlaylists } from '../../../lib/hooks';
import { ArrowDownToLine, ArrowUpToLine, Plus, Search } from '../../../lib/icons';
import { matchesTerms, queryTerms, searchKey } from '../../../lib/search-key';
import type { Track } from '../../../stores/player';
import { useSettingsStore } from '../../../stores/settings';
import { ModalClose } from '../../ui/Modal';
import { Skeleton } from '../../ui/Skeleton';
import { Choice } from './Choice';
import { NewPlaylist } from './NewPlaylist';
import { PickerHeader } from './PickerHeader';
import { PlaylistList } from './PlaylistList';

const WAITING_ROWS = ['a', 'b', 'c', 'd', 'e'];

export function PlaylistPicker({ track }: { track: Track }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const name = query.trim();
  const { playlists, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useMyPlaylists(
    30,
    true,
    name !== '',
  );

  const shown = useMemo(() => {
    const terms = queryTerms(name);
    return playlists.filter((playlist) => matchesTerms(terms, playlist.title));
  }, [playlists, name]);
  const taken = shown.some((playlist) => searchKey(playlist.title) === searchKey(name));

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const startDraft = () => {
    setDraft(name);
    setQuery('');
  };

  return (
    <div data-ui="playlist-picker" className="flex h-[min(680px,85vh)] flex-col">
      <PickerHeader track={track} />

      <form
        className="relative mx-5 mb-3 shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          if (name && !taken) startDraft();
        }}
      >
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-40"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('playlist.findOrCreate')}
          aria-label={t('playlist.findOrCreate')}
          className="h-11 w-full rounded-2xl bg-ink/[0.06] pl-10 pr-4 text-[13.5px] text-ink-92 outline-none ring-1 ring-ink/[0.07] transition-shadow placeholder:text-ink-40 focus:ring-accent/60 [&::-webkit-search-cancel-button]:hidden"
        />
      </form>

      {draft !== null ? (
        <NewPlaylist track={track} name={draft} onClose={() => setDraft(null)} />
      ) : (
        !taken && (
          <button
            type="button"
            onClick={startDraft}
            data-ui="playlist-picker-create"
            className="group mx-3 mb-1 flex h-16 shrink-0 cursor-pointer items-center gap-3.5 rounded-2xl px-2.5 text-left transition-colors duration-150 hover:bg-accent/[0.09]"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent/[0.14] text-accent transition-colors group-hover:bg-accent group-hover:text-accent-contrast">
              <Plus size={20} />
            </span>
            <span className="truncate text-[13.5px] font-semibold text-accent">
              {name ? t('playlist.createNamed', { name }) : t('playlist.newPlaylist')}
            </span>
          </button>
        )
      )}

      {isLoading ? (
        <div className="space-y-2 px-5 pb-4">
          {WAITING_ROWS.map((row) => (
            <Skeleton key={row} className="h-[58px] w-full" rounded="lg" />
          ))}
        </div>
      ) : (
        <PlaylistList playlists={shown} trackUrn={track.urn} onEnd={loadMore} />
      )}

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-ink/[0.06] px-4 py-3">
        <PlaceChoice />
        <ModalClose className="h-[38px] shrink-0 cursor-pointer rounded-xl bg-ink/[0.1] px-5 text-[12.5px] font-semibold text-ink-92 transition-colors hover:bg-ink/[0.17]">
          {t('playlist.pickDone')}
        </ModalClose>
      </footer>
    </div>
  );
}

function PlaceChoice() {
  const { t } = useTranslation();
  const place = useSettingsStore((s) => s.playlistPlace);
  const setPlace = useSettingsStore((s) => s.setPlaylistPlace);
  return (
    <Choice
      data-ui="playlist-picker-place"
      label={t('playlist.place')}
      value={place}
      onChange={setPlace}
      options={[
        { id: 'start', label: t('playlist.placeStart'), icon: <ArrowUpToLine size={14} /> },
        { id: 'end', label: t('playlist.placeEnd'), icon: <ArrowDownToLine size={14} /> },
      ]}
    />
  );
}
