import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Loader2, Search } from '../../../lib/icons';
import { MIN_SEARCH_QUERY, useCatalogTracks } from '../../../lib/search';
import type { Track } from '../../../stores/player';
import { useDebouncedValue } from '../../discover/useDebouncedValue';

const SHOWN = 6;
const DEBOUNCE_MS = 300;

function Row({ track, onPick }: { track: Track; onPick: (track: Track) => void }) {
  const cover = art(track.artwork_url || track.user?.avatar_url, 't200x200');
  return (
    <button
      type="button"
      onClick={() => onPick(track)}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-ink/[0.07]"
    >
      <span className="size-9 shrink-0 overflow-hidden rounded-md bg-ink/[0.06]">
        {cover && <img src={cover} alt="" className="size-full object-cover" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-ink-88">
          {track.title}
        </span>
        <span className="block truncate text-[11px] text-ink-45">{track.user?.username}</span>
      </span>
    </button>
  );
}

export function SuggestSearch({ onPick }: { onPick: (track: Track) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const query = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const results = useCatalogTracks(query);
  const ready = query.length >= MIN_SEARCH_QUERY;
  const tracks = ready ? results.items.slice(0, SHOWN) : [];

  return (
    <div>
      <label className="flex h-9 items-center gap-2 rounded-[10px] bg-ink/[0.06] px-2.5 text-ink-40">
        <Search size={14} className="shrink-0" />
        <input
          autoFocus
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('chat.room.suggest.search')}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-35"
        />
        {ready && results.isFetching && <Loader2 size={13} className="shrink-0 animate-spin" />}
      </label>
      <div className="mt-1 max-h-[300px] overflow-y-auto">
        {tracks.map((track) => (
          <Row key={track.urn} track={track} onPick={onPick} />
        ))}
        {ready && !results.isFetching && tracks.length === 0 && (
          <p className="px-2 py-4 text-center text-[12px] text-ink-35">
            {t('chat.room.suggest.empty')}
          </p>
        )}
      </div>
    </div>
  );
}
