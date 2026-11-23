import React from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { art } from '../../lib/formatters';
import type { Comment } from '../../lib/hooks';
import { Disc3 } from '../../lib/icons';
import { litStyle } from '../../lib/page-glow';
import {
  getAlbumTarget,
  getArtistDisplay,
  getArtistLinkItems,
  getArtistTarget,
  getDisplayTitle,
  getParticipants,
} from '../../lib/track-display';
import type { Track } from '../../stores/player';
import { ArtistNameLinks } from '../music/ArtistNameLinks';
import { TrackStatusBadges } from '../music/TrackStatusBadges';
import { UploadKindDot } from '../music/UploadKindDot';
import { ArtistLinks } from './ArtistLinks';
import { RoomFloor } from './RoomFloor';
import { TrackActionRail } from './TrackActionRail';
import { TrackCover } from './TrackCover';

const CHIP =
  'rounded-full border border-ink/[0.07] bg-ink/[0.05] px-2.5 py-1 text-[10px] font-semibold';

export const RoomHero = React.memo(function RoomHero({
  track,
  isThis,
  isThisPlaying,
  isOwner,
  glow,
  comments,
  onPlay,
  onSeek,
}: {
  track: Track;
  isThis: boolean;
  isThisPlaying: boolean;
  isOwner: boolean;
  glow: readonly string[];
  comments: Comment[];
  onPlay: () => void;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const cover = art(track.artwork_url, 't500x500');
  const title = getDisplayTitle(track);
  const ad = getArtistDisplay(track);
  const participants = getParticipants(track, ['remixer', 'producer']);
  const artistLinks = getArtistLinkItems(track);
  const mainLink = artistLinks.slice(0, 1);
  const featLinks = artistLinks.slice(1);
  const primaryArtist = track.enrichment?.primary_artist;
  const heroAvatarSrc = primaryArtist?.avatar_url ?? track.user.avatar_url;
  const heroAvatarTarget = primaryArtist?.avatar_url
    ? `/artist/${encodeURIComponent(primaryArtist.id)}`
    : track.user.urn
      ? `/user/${encodeURIComponent(track.user.urn)}`
      : getArtistTarget(track);
  const album = track.enrichment?.album;
  const albumTarget = getAlbumTarget(track);
  const year = track.release_year ?? album?.year;

  return (
    <section
      data-ui="track-hero"
      className="@container panel lit relative rounded-3xl"
      style={litStyle(glow)}
    >
      <div className="relative p-6 @min-[512px]:p-8 flex flex-col gap-7">
        <div className="flex flex-col @min-[740px]:flex-row items-center @min-[740px]:items-start gap-6 @min-[740px]:gap-8">
          <TrackCover
            title={title}
            coverUrl={cover ?? undefined}
            isPlaying={isThisPlaying}
            isCurrent={isThis}
            onToggle={onPlay}
          />

          <div className="flex-1 min-w-0 w-full text-center @min-[740px]:text-left">
            <div className="flex items-center gap-2 flex-wrap justify-center @min-[740px]:justify-start mb-3.5">
              <TrackStatusBadges meta={track._scd_meta} videos={track.videos} />
              {track.genre && (
                <span className={`${CHIP} uppercase tracking-[0.14em] text-ink-60`}>
                  {track.genre}
                </span>
              )}
              {year && <span className={`${CHIP} tabular-nums text-ink-45`}>{year}</span>}
              {albumTarget && album?.title && (
                <button
                  type="button"
                  onClick={() => navigate(albumTarget)}
                  title={t('track.openAlbum', { title: album.title })}
                  className={`${CHIP} inline-flex max-w-[16rem] cursor-pointer items-center gap-1.5 text-ink-60 transition-colors duration-200 hover:bg-ink/[0.1] hover:text-ink-90`}
                >
                  <Disc3 size={11} className="shrink-0" />
                  <span className="truncate">{album.title}</span>
                </button>
              )}
            </div>

            <h1 className="text-4xl @min-[512px]:text-6xl @min-[960px]:text-7xl font-black leading-[0.95] tracking-tighter break-words text-ink">
              {title}
            </h1>

            <div className="mt-4">
              <div className="inline-flex items-center gap-2.5 group/artist">
                {heroAvatarSrc && (
                  <img
                    src={art(heroAvatarSrc, 'small') ?? ''}
                    alt=""
                    className={`w-7 h-7 rounded-full ring-1 ring-ink/[0.1] transition-all duration-200 ${
                      heroAvatarTarget ? 'cursor-pointer hover:ring-ink/[0.22]' : ''
                    }`}
                    onClick={heroAvatarTarget ? () => navigate(heroAvatarTarget) : undefined}
                  />
                )}
                <span className="text-[15px] font-medium text-ink-75">
                  <ArtistNameLinks
                    items={mainLink}
                    linkClassName="cursor-pointer transition-colors hover:text-ink"
                  />
                </span>
                {ad.isEnriched && ad.verified && (
                  <span
                    className="text-[11px] text-ok"
                    title={t('track.verifiedArtist', {
                      confidence: (ad.confidence ?? 0).toFixed(2),
                    })}
                  >
                    ✓
                  </span>
                )}
                {ad.isEnriched && !ad.verified && (
                  <span
                    className="text-[11px] text-ink-40"
                    title={t('track.unverifiedArtist', {
                      confidence: (ad.confidence ?? 0).toFixed(2),
                    })}
                  >
                    ?
                  </span>
                )}
                {ad.uploadKind && (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-55">
                    <UploadKindDot kind={ad.uploadKind} />
                    {t(`track.uploadKind.${ad.uploadKind}`)}
                  </span>
                )}
              </div>

              {(featLinks.length > 0 || participants || ad.uploader) && (
                <div className="mt-1.5 text-[12px] text-ink-40 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 justify-center @min-[740px]:justify-start">
                  {featLinks.length > 0 && (
                    <span>
                      {t('track.feat')}{' '}
                      <ArtistNameLinks
                        items={featLinks}
                        linkClassName="cursor-pointer text-ink-55 hover:text-ink-85 transition-colors"
                      />
                    </span>
                  )}
                  {participants?.remixers && participants.remixers.length > 0 && (
                    <span>
                      {featLinks.length > 0 && '· '}
                      <ArtistLinks artists={participants.remixers} /> {t('track.remix')}
                    </span>
                  )}
                  {participants?.producers && participants.producers.length > 0 && (
                    <span>
                      {(featLinks.length > 0 || participants.remixers.length > 0) && '· '}
                      {t('track.prod')} <ArtistLinks artists={participants.producers} />
                    </span>
                  )}
                  {(featLinks.length > 0 || participants) && ad.uploader && <span>·</span>}
                  {ad.uploader && (
                    <Trans
                      i18nKey="track.uploadedBy"
                      values={{ name: ad.uploader }}
                      components={[
                        <span
                          key="u"
                          className="text-ink-55 hover:text-ink-80 cursor-pointer transition-colors"
                          onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
                        />,
                      ]}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center @min-[740px]:justify-start">
              <TrackActionRail
                track={track}
                isPlaying={isThisPlaying}
                isCurrent={isThis}
                isOwner={isOwner}
                onPlay={onPlay}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-ink/[0.07]">
          <RoomFloor track={track} isCurrent={isThis} comments={comments} onSeek={onSeek} />
        </div>
      </div>
    </section>
  );
});
