import {memo, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {dur, fc} from '../../lib/formatters';
import {ListMusic, Music} from '../../lib/icons';
import {useArtistDisplay, useDisplayTitle} from '../../lib/track-display';
import type {Track} from '../../stores/player';
import {ALBUM_SHAPE, TrackColumns} from '../music/columns/TrackColumns';
import {AlbumTrackRow} from './AlbumTrackRow';

interface AlbumTrackListProps {
  tracks: Track[];
}

interface Partitioned {
  available: Track[];
  wanted: Track[];
  totalDuration: number;
}

function partition(tracks: Track[]): Partitioned {
  const available: Track[] = [];
  const wanted: Track[] = [];
  let totalDuration = 0;
  for (const t of tracks) {
    if (t.enrichment?.availability === 'wanted') {
      wanted.push(t);
    } else {
      available.push(t);
      totalDuration += t.duration ?? 0;
    }
  }
  return { available, wanted, totalDuration };
}

const WantedRow = memo(function WantedRow({ track, position }: { track: Track; position: number }) {
  const displayTitle = useDisplayTitle(track);
  const artistDisplay = useArtistDisplay(track);
  return (
    <div className="flex items-center gap-4 rounded-2xl px-4 py-2.5 opacity-50">
      <div className="w-10 h-10 flex items-center justify-center shrink-0">
        <span className="text-[13px] text-ink-25 tabular-nums font-semibold">{position}</span>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink/[0.03] ring-1 ring-ink/[0.07]">
        <Music size={14} className="text-ink-20" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-ink-55 truncate">{displayTitle}</p>
        <p className="text-[11px] text-ink-25 truncate">{artistDisplay.primary}</p>
      </div>
      {track.duration ? (
        <span className="text-[11px] text-ink-25 tabular-nums shrink-0 w-12 text-right">
          {dur(track.duration)}
        </span>
      ) : (
        <span className="text-[11px] text-ink-15 shrink-0 w-12 text-right">—</span>
      )}
    </div>
  );
});

function AlbumTrackListImpl({ tracks }: AlbumTrackListProps) {
  const { t } = useTranslation();
  const { available, wanted, totalDuration } = useMemo(() => partition(tracks), [tracks]);

  if (tracks.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink/[0.03] ring-1 ring-ink/[0.07]">
          <Music size={24} className="text-ink-15" />
        </div>
        <p className="text-ink-30 text-sm">{t('album.noTracks')}</p>
      </div>
    );
  }

  return (
    <div className="panel p-3 md:p-5">
      <div className="flex items-center justify-between px-3 pt-2 pb-4">
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-ink-55">
          <ListMusic size={12} /> {t('album.tracks')}
          <span className="text-ink-25 ml-1">{available.length}</span>
        </span>
        <span className="text-[11px] text-ink-30 font-bold uppercase tracking-[0.18em] tabular-nums">
          {dur(totalDuration)}
        </span>
      </div>

      {available.length > 0 && (
        <TrackColumns shape={ALBUM_SHAPE}>
        <div className="flex flex-col gap-1">
          {available.map((track, i) => (
            <AlbumTrackRow
              key={track.urn}
              track={track}
              position={i + 1}
              queue={available}
            />
          ))}
        </div>
        </TrackColumns>
      )}

      {wanted.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 px-3">
            <span className="rounded-full bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink ring-1 ring-accent/30">
              {t('album.comingSoon')}
            </span>
            <span className="text-[11px] text-ink-30 tabular-nums">{fc(wanted.length)}</span>
            <div className="flex-1 h-px bg-ink/[0.05]" />
          </div>
          <div className="flex flex-col gap-1">
            {wanted.map((track, i) => (
              <WantedRow key={track.urn} track={track} position={available.length + i + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const AlbumTrackList = memo(AlbumTrackListImpl);
