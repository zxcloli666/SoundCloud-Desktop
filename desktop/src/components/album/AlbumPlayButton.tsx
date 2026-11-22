import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { pauseWhite14, playWhite14 } from '../../lib/icons';
import { useIsPlayingFrom } from '../../lib/useTrackPlay';
import { type Track, usePlayerStore } from '../../stores/player';

interface AlbumPlayButtonProps {
  tracks: Track[];
}

function AlbumPlayButtonImpl({ tracks }: AlbumPlayButtonProps) {
  const { t } = useTranslation();

  const { playable, playableUrns } = useMemo(() => {
    const list: Track[] = [];
    const urns = new Set<string>();
    for (const tr of tracks) {
      if (tr.enrichment?.availability !== 'wanted') {
        list.push(tr);
        urns.add(tr.urn);
      }
    }
    return { playable: list, playableUrns: urns };
  }, [tracks]);

  const isPlayingFromAlbum = useIsPlayingFrom(playableUrns);

  const icon = isPlayingFromAlbum ? pauseWhite14 : playWhite14;

  const empty = playable.length === 0;

  const onClick = useCallback(() => {
    if (empty) return;
    const { play, pause, resume, currentTrack } = usePlayerStore.getState();
    const currentUrn = currentTrack?.urn;
    if (isPlayingFromAlbum) {
      pause();
      return;
    }
    if (currentUrn && playableUrns.has(currentUrn)) {
      resume();
      return;
    }
    play(playable[0], playable);
  }, [empty, isPlayingFromAlbum, playable, playableUrns]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={empty}
      className="inline-flex h-11 cursor-pointer items-center gap-3 rounded-full bg-accent pl-2 pr-5 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-shade-15">
        {icon}
      </span>
      <span>{isPlayingFromAlbum ? t('album.pauseAlbum') : t('album.playAlbum')}</span>
    </button>
  );
}

export const AlbumPlayButton = memo(AlbumPlayButtonImpl);
