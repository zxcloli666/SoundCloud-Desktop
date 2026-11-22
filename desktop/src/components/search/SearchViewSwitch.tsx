import { GalleryVerticalEnd, LayoutGrid } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { useSearchTracks } from '../../lib/search';
import { useSearchPrefsStore } from '../../stores/searchPrefs';

const STACK = 3;

export const SearchViewSwitch = memo(function SearchViewSwitch({ q }: { q: string }) {
  const { t } = useTranslation();
  const mode = useSearchPrefsStore((s) => s.mode);
  const view = useSearchPrefsStore((s) => s.view);
  const toggleView = useSearchPrefsStore((s) => s.toggleView);
  const { items } = useSearchTracks(mode, q);
  const covers = view === 'covers';
  const label = covers ? t('search.view.moments') : t('search.view.covers');

  return (
    <button
      type="button"
      data-ui="search-view"
      onClick={toggleView}
      title={`${label} (M)`}
      className="chip-toggle pl-2"
    >
      {covers && items.length > 0 ? (
        <span className="flex items-center pl-2">
          {items.slice(0, STACK).map((track, i) => (
            <CoverChip key={track.urn} url={track.artwork_url} tilt={(i - 1) * 8} />
          ))}
        </span>
      ) : covers ? (
        <GalleryVerticalEnd size={14} className="ml-1.5" />
      ) : (
        <LayoutGrid size={14} className="ml-1.5" />
      )}
      {label}
    </button>
  );
});

function CoverChip({ url, tilt }: { url: string | null | undefined; tilt: number }) {
  const cover = art(url, 't67x67');
  return (
    <span
      className="-ml-2 size-6 shrink-0 overflow-hidden rounded-[7px] ring-1 ring-ink/20"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      {cover ? (
        <img src={cover} alt="" draggable={false} className="size-full object-cover" />
      ) : (
        <span className="block size-full bg-ink/[0.08]" />
      )}
    </span>
  );
}
