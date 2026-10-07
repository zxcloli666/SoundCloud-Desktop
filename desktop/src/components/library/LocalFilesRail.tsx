import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { HardDrive, Music, pauseBlack20, playBlack20 } from '../../lib/icons';
import { localArtist } from '../../lib/local-library';
import { useTrackPlay } from '../../lib/useTrackPlay';
import { useLocalLibrary } from '../../stores/local-library';
import type { Track } from '../../stores/player';
import { buildLocalRows, type LocalRow } from '../offline/local/lib';
import { CollectionRail } from './CollectionRail';

const PREVIEW = 14;
const LOCAL_SECTION = { section: 'local' };

const LocalTile = React.memo(function LocalTile({ row, queue }: { row: LocalRow; queue: Track[] }) {
  const { isThisPlaying, togglePlay } = useTrackPlay(row.track, queue);
  const artwork = art(row.track.artwork_url, 't300x300');

  return (
    <div className="group w-[150px] shrink-0 select-none">
      <button
        type="button"
        onClick={togglePlay}
        className="relative block aspect-square w-full cursor-pointer overflow-hidden rounded-2xl ring-1 ring-white/[0.06] transition-all duration-300 ease-[var(--ease-apple)] group-hover:ring-white/[0.12]"
      >
        {artwork ? (
          <img
            src={artwork}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 ease-[var(--ease-apple)] group-hover:scale-[1.04]"
            decoding="async"
            loading="lazy"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-white/35"
            style={{
              background:
                'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.03) 75%)',
            }}
          >
            <Music size={30} strokeWidth={1.6} />
          </span>
        )}
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 group-hover:bg-black/30 ${
            isThisPlaying ? 'bg-black/30 opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-white shadow-xl">
            {isThisPlaying ? pauseBlack20 : playBlack20}
          </span>
        </span>
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-white/75 backdrop-blur-md">
          <HardDrive size={10} />
        </span>
      </button>
      <div className="mt-2 px-0.5">
        <p className="truncate text-[13px] font-medium text-white/88">{row.info.title}</p>
        <p className="truncate text-[11.5px] text-white/40">{localArtist(row.info)}</p>
      </div>
    </div>
  );
});

export const LocalFilesRail = React.memo(function LocalFilesRail() {
  const { t } = useTranslation();
  const tracks = useLocalLibrary((s) => s.tracks);
  const order = useLocalLibrary((s) => s.order);
  const missing = useLocalLibrary((s) => s.missing);

  const rows = useMemo(
    () => buildLocalRows(order, tracks, missing).filter((r) => !r.missing),
    [order, tracks, missing],
  );
  const preview = useMemo(() => rows.slice(0, PREVIEW), [rows]);
  const queue = useMemo(() => rows.map((r) => r.track), [rows]);

  if (preview.length === 0) return null;

  return (
    <CollectionRail
      icon={<HardDrive size={16} />}
      title={t('local.libraryTitle')}
      count={order.length}
      to="/offline"
      state={LOCAL_SECTION}
    >
      {preview.map((row) => (
        <LocalTile key={row.id} row={row} queue={queue} />
      ))}
    </CollectionRail>
  );
});
