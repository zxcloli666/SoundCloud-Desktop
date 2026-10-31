import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../../lib/formatters';
import { Music, Repeat2, X } from '../../../lib/icons';
import { useSuperlikedTracks } from '../../../lib/superlikes';
import type { Track } from '../../../stores/player';

export const SlotPicker = memo(function SlotPicker({
  toFree,
  onPick,
}: {
  toFree: number;
  onPick: (track: Track) => void;
}) {
  const { t } = useTranslation();
  const { tracks } = useSuperlikedTracks();
  if (tracks.length === 0) return null;
  const moves = toFree === 1;

  return (
    <div className="mt-5">
      <p className="mb-2.5 text-[12px] font-medium text-ink-45">
        {moves ? t('superlike.freeSlot') : t('superlike.freeSlots', { count: toFree })}
      </p>
      <div className="grid max-h-[13.5rem] grid-cols-5 gap-2 overflow-y-auto p-0.5">
        {tracks.map((track) => (
          <SlotCover key={track.urn} track={track} moves={moves} onPick={onPick} />
        ))}
      </div>
    </div>
  );
});

function SlotCover({
  track,
  moves,
  onPick,
}: {
  track: Track;
  moves: boolean;
  onPick: (track: Track) => void;
}) {
  const { t } = useTranslation();
  const cover = art(track.artwork_url, 't200x200');
  const label = t(moves ? 'superlike.moveFrom' : 'superlike.removeFrom', { title: track.title });
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => onPick(track)}
      className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-ink/[0.08] transition-all duration-200 hover:ring-superlike-via/70 hover:scale-[1.04] cursor-pointer"
    >
      {cover ? (
        <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-ink/[0.05] text-ink-25">
          <Music size={16} />
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {moves ? <Repeat2 size={18} /> : <X size={18} />}
      </span>
    </button>
  );
}
