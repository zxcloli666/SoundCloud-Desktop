import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { designPreviewTracks, isDesignPreview } from '../../lib/design-preview';
import { art } from '../../lib/formatters';
import { ListMusic, MicVocal, Play, X } from '../../lib/icons';
import { getArtistDisplay, getDisplayTitle } from '../../lib/track-display';
import { useLyricsStore } from '../../stores/lyrics';
import { usePlayerStore } from '../../stores/player';
import { LikeButton } from '../music/LikeButton';
import { RightPanelShell } from './RightPanelShell';

export const NowPlayingContext = React.memo(
  ({
    open,
    onQueueToggle,
    queueOpen,
    onClose,
  }: {
    open: boolean;
    onQueueToggle: () => void;
    queueOpen: boolean;
    onClose: () => void;
  }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { storeTrack, queuedNextTrack } = usePlayerStore(
      useShallow((state) => ({
        storeTrack: state.currentTrack,
        queuedNextTrack: state.queue[state.queueIndex + 1],
      })),
    );
    const preview = isDesignPreview();
    const track = preview ? designPreviewTracks[0] : storeTrack;
    const nextTrack = preview ? designPreviewTracks[1] : queuedNextTrack;

    if (!track) {
      return (
        <RightPanelShell open={open} onClose={onClose} ariaLabel={t('player.nowPlaying')}>
          <div className="sonveil-context">
            <header className="sonveil-context-header" data-tauri-drag-region>
              <span>{t('player.nowPlaying')}</span>
              <button
                type="button"
                className="sonveil-context-close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </header>
            <div className="sonveil-context-empty">
              <span>
                <Play size={18} fill="currentColor" />
              </span>
              <p>{t('player.notPlaying')}</p>
            </div>
          </div>
        </RightPanelShell>
      );
    }

    const artwork = art(
      track.enrichment?.album?.cover_url || track.artwork_url || track.user.avatar_url,
      't500x500',
    );
    const nextArtwork = nextTrack
      ? art(nextTrack.artwork_url || nextTrack.user.avatar_url, 't200x200')
      : null;

    return (
      <RightPanelShell open={open} onClose={onClose} ariaLabel={t('player.nowPlaying')}>
        <div className="sonveil-context">
          <header className="sonveil-context-header" data-tauri-drag-region>
            <span>{t('player.nowPlaying')}</span>
            <div className="sonveil-context-header-actions">
              <LikeButton track={track} variant="editorial" />
              <button
                type="button"
                className="sonveil-context-close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="sonveil-context-scroll">
            <button
              type="button"
              className="sonveil-context-art"
              onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
              aria-label={t('track.openTrackPage')}
            >
              {artwork ? <img src={artwork} alt="" decoding="async" /> : <span />}
            </button>

            <div className="sonveil-context-copy">
              <button
                type="button"
                onClick={() => navigate(`/track/${encodeURIComponent(track.urn)}`)}
              >
                {getDisplayTitle(track)}
              </button>
              <p>{getArtistDisplay(track).primary}</p>
            </div>

            <div className="sonveil-context-actions">
              <button
                type="button"
                  onClick={() => {
                  onClose();
                  useLyricsStore.getState().openPanel({ rightPanelOpen: false });
                }}
              >
                <MicVocal size={16} />
                <span>{t('track.lyrics')}</span>
              </button>
              <button
                type="button"
                className={queueOpen ? 'is-active' : ''}
                onClick={onQueueToggle}
              >
                <ListMusic size={16} />
                <span>{t('player.queue')}</span>
              </button>
            </div>

            {nextTrack && (
              <section className="sonveil-context-next">
                <span>{t('player.upNext')}</span>
                <button type="button" onClick={onQueueToggle}>
                  <span className="sonveil-context-next-art">
                    {nextArtwork ? (
                      <img src={nextArtwork} alt="" loading="lazy" decoding="async" />
                    ) : null}
                  </span>
                  <span className="sonveil-context-next-copy">
                    <b>{getDisplayTitle(nextTrack)}</b>
                    <small>{getArtistDisplay(nextTrack).primary}</small>
                  </span>
                </button>
              </section>
            )}
          </div>
        </div>
      </RightPanelShell>
    );
  },
);
