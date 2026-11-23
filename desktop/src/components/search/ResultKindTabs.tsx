import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { PILL_ROW } from './PillTabs';

export type ResultKind = 'tracks' | 'albums' | 'playlists' | 'artists';

const KINDS: { id: ResultKind; label: string }[] = [
  { id: 'tracks', label: 'search.tracks' },
  { id: 'albums', label: 'artist.albums' },
  { id: 'playlists', label: 'search.playlists' },
  { id: 'artists', label: 'search.artists' },
];

export const ResultKindTabs = memo(function ResultKindTabs({
  active,
  onSelect,
}: {
  active: ResultKind;
  onSelect: (kind: ResultKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto mb-3 flex w-full max-w-[1100px] px-4">
      <div role="tablist" data-ui="search-kinds" className={PILL_ROW}>
        {KINDS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => onSelect(id)}
            className="chip-seg"
          >
            {t(label)}
          </button>
        ))}
      </div>
    </div>
  );
});
