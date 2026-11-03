import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/shallow';
import { useMyPlaylists } from '../../lib/hooks';
import { Heart, ListMusic, Plus } from '../../lib/icons';
import { type DestinationMode, useImportStore } from '../../stores/import';
import { TrackCover } from './ImportFinder';

const MODES: { id: DestinationMode; icon: typeof Heart }[] = [
  { id: 'create', icon: Plus },
  { id: 'likes', icon: Heart },
  { id: 'existing', icon: ListMusic },
];

export function ImportDestination() {
  const { t } = useTranslation();
  const { destination, setDestination, cover, found } = useImportStore(
    useShallow((s) => {
      const first = s.rows.find((row) => row.urn);
      return {
        destination: s.destination,
        setDestination: s.setDestination,
        cover: first?.urn ? s.tracks[first.urn] : undefined,
        found: s.rows.filter((row) => row.urn).length,
      };
    }),
  );
  const mine = useMyPlaylists(100, destination.mode === 'existing');

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label={t('importer.destination')}
        className="flex gap-0.5 rounded-[11px] border border-ink/[0.08] bg-ink/[0.02] p-[3px]"
      >
        {MODES.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={destination.mode === id}
            onClick={() => setDestination({ mode: id })}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-[7px] text-[12px] font-medium transition-colors cursor-pointer ${
              destination.mode === id
                ? 'bg-ink/[0.08] text-ink-92 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                : 'text-ink-50 hover:text-ink-80'
            }`}
          >
            <Icon size={13} />
            {t(`importer.mode.${id}`)}
          </button>
        ))}
      </div>

      {destination.mode === 'create' && (
        <div className="flex items-center gap-3">
          <TrackCover track={cover} />
          <input
            value={destination.name}
            onChange={(e) => setDestination({ name: e.target.value })}
            placeholder={t('importer.namePlaceholder')}
            className="min-w-0 flex-1 rounded-xl border border-ink/[0.06] bg-ink/[0.04] px-4 py-2.5 text-[13px] text-ink-80 outline-none transition-all placeholder:text-ink-20 focus:border-ink/[0.12] focus:bg-ink/[0.06]"
          />
          <span className="shrink-0 font-mono text-[12px] text-ink-40">{found}</span>
        </div>
      )}

      {destination.mode === 'existing' && (
        <select
          value={destination.playlistUrn ?? ''}
          onChange={(e) => setDestination({ playlistUrn: e.target.value || null })}
          className="w-full rounded-xl border border-ink/[0.06] bg-ink/[0.04] px-4 py-2.5 text-[13px] text-ink-80 outline-none focus:border-ink/[0.12]"
        >
          <option value="">{t('importer.pickPlaylist')}</option>
          {mine.playlists.map((playlist) => (
            <option key={playlist.urn} value={playlist.urn}>
              {playlist.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
