import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Aura, auraRgb, auraRgba, isLight } from '../../lib/aura';
import { pauseBlack14, pauseWhite14, playBlack14, playWhite14 } from '../../lib/icons';
import { useIsPlayingFrom } from '../../lib/useTrackPlay';
import { type Track, usePlayerStore } from '../../stores/player';

interface AlbumPlayButtonProps {
  tracks: Track[];
  aura: Aura;
}

function AlbumPlayButtonImpl({ tracks, aura }: AlbumPlayButtonProps) {
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

  const lightAura = isLight(aura);
  const icon = isPlayingFromAlbum
    ? lightAura
      ? pauseBlack14
      : pauseWhite14
    : lightAura
      ? playBlack14
      : playWhite14;

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
      className="group relative inline-flex items-center gap-3 h-11 pl-2 pr-5 rounded-full text-[13px] font-semibold cursor-pointer transition-all duration-500 hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: `linear-gradient(180deg, ${auraRgba(aura, 0.85)}, ${auraRgba(aura, 0.65)})`,
        color: lightAura ? '#000' : '#fff',
        boxShadow: `0 12px 32px ${auraRgba(aura, 0.45)}, inset 0 0 0 1px ${auraRgba(aura, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.3)`,
      }}
    >
      <span
        className="w-7 h-7 rounded-full flex items-center justify-center"
        style={{
          background: lightAura ? 'rgba(0,0,0,0.18)' : 'rgb(var(--ink) / 0.18)',
          boxShadow: `inset 0 0 0 1px ${lightAura ? 'rgb(var(--shade) / calc(0.25 * var(--shade-alpha)))' : 'rgba(255,255,255,0.25)'}`,
        }}
      >
        {icon}
      </span>
      <span className="tracking-wide">
        {isPlayingFromAlbum ? t('album.pauseAlbum') : t('album.playAlbum')}
      </span>
      <span
        className="absolute inset-0 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{ boxShadow: `0 0 60px ${auraRgb(aura)}` }}
      />
    </button>
  );
}

export const AlbumPlayButton = memo(AlbumPlayButtonImpl);
