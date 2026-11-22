import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cancelTrackLoad } from '../../../lib/audio';
import { art } from '../../../lib/formatters';
import { Loader2, X } from '../../../lib/icons';
import { isLocalUrn } from '../../../lib/local-library';
import { useArtistDisplay, useArtistLinkItems, useDisplayTitle } from '../../../lib/track-display';
import { useTrackContextMenu } from '../../../lib/useTrackContextMenu';
import { useLyricsStore } from '../../../stores/lyrics';
import { type Track, usePlayerStore } from '../../../stores/player';
import { AltUploadMark } from '../../music/AltUploadMark';
import { ArtistNameLinks } from '../../music/ArtistNameLinks';
import { UploadKindDot } from '../../music/UploadKindDot';
import { NowPlayingNameCard } from '../NowPlayingNameCard';
import { loadPercent } from './load-progress';

export const PillTrack = React.memo(({ loadProgress }: { loadProgress: number | null }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentTrack = usePlayerStore((s) => s.currentTrack);

  if (!currentTrack) {
    return (
      <div className="npb-meta">
        <div className="npb-art">
          <div className="npb-artfb" />
        </div>
        <div className="npb-txt">
          <span className="npb-sub">
            <span>{t('player.notPlaying')}</span>
          </span>
        </div>
      </div>
    );
  }

  return <PillTrackBody track={currentTrack} navigate={navigate} loadProgress={loadProgress} />;
});

const PillTrackBody = React.memo(function PillTrackBody({
  track,
  navigate,
  loadProgress,
}: {
  track: Track;
  navigate: ReturnType<typeof useNavigate>;
  loadProgress: number | null;
}) {
  const { t } = useTranslation();
  const openLyricsPanel = useLyricsStore((s) => s.openPanel);
  const artistDisplay = useArtistDisplay(track);
  const displayTitle = useDisplayTitle(track);
  const artistLinks = useArtistLinkItems(track);
  const artworkSmall = art(track.artwork_url || track.user?.avatar_url, 't200x200');
  const hasArtistLink = artistLinks.some((it) => it.target);
  const loadedPercent = loadProgress == null ? null : loadPercent(loadProgress);
  const onContextMenu = useTrackContextMenu(track);

  return (
    <div className="npb-meta" onContextMenu={onContextMenu}>
      <div
        className="npb-art"
        data-ui="player-art"
        onClick={() => openLyricsPanel({ rightPanelOpen: false })}
      >
        {artworkSmall ? <img src={artworkSmall} alt="" /> : <div className="npb-artfb" />}
        <span className="npb-ring" />
        <span className="npb-eq">
          <i />
          <i />
          <i />
          <i />
        </span>
        {loadedPercent != null && (
          <button
            type="button"
            className="npb-art-load"
            title={t('player.cancelLoad')}
            aria-label={t('player.cancelLoad')}
            onClick={(e) => {
              e.stopPropagation();
              cancelTrackLoad();
            }}
          >
            <span className="npb-art-load-value">
              {loadedPercent > 0 ? (
                `${loadedPercent}%`
              ) : (
                <Loader2 size={16} className="animate-spin" />
              )}
            </span>
            <X size={16} className="npb-art-load-cancel" />
          </button>
        )}
      </div>
      <NowPlayingNameCard key={track.urn} track={track}>
        <span
          className="npb-ttl"
          data-ui="player-title"
          onClick={() =>
            isLocalUrn(track.urn)
              ? navigate('/offline', { state: { section: 'local' } })
              : navigate(`/track/${encodeURIComponent(track.urn)}`)
          }
        >
          {displayTitle}
        </span>
        <span className={`npb-sub${hasArtistLink ? ' is-link' : ''}`}>
          <AltUploadMark urn={track.urn} />
          <UploadKindDot kind={artistDisplay.uploadKind} />
          <span>
            <ArtistNameLinks items={artistLinks} />
          </span>
        </span>
      </NowPlayingNameCard>
    </div>
  );
});
