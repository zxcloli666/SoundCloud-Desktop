import React from 'react';
import {Trans, useTranslation} from 'react-i18next';
import {useNavigate} from 'react-router-dom';
import {art} from '../../lib/formatters';
import type {Comment} from '../../lib/hooks';
import {Disc3} from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {
  getAlbumTarget,
  getArtistDisplay,
  getArtistLinkItems,
  getArtistTarget,
  getDisplayTitle,
  getParticipants,
} from '../../lib/track-display';
import type {Track} from '../../stores/player';
import {ArtistNameLinks} from '../music/ArtistNameLinks';
import {TrackStatusBadges} from '../music/TrackStatusBadges';
import {ArtistLinks} from './ArtistLinks';
import {RoomFloor} from './RoomFloor';
import {TrackActionRail} from './TrackActionRail';
import {TrackCover} from './TrackCover';
import type {TrackAura} from './useTrackAura';

const KIND_TONE: Record<string, string> = {
  original: 'bg-emerald-500/15 text-emerald-300/90',
  demo: 'bg-sky-500/15 text-sky-300/90',
  alt: 'bg-violet-500/15 text-violet-300/90',
  reupload: 'bg-amber-500/12 text-amber-300/80',
  cover: 'bg-fuchsia-500/15 text-fuchsia-300/90',
};

export const RoomHero = React.memo(function RoomHero({
  track,
  aura,
  isThis,
  isThisPlaying,
  isOwner,
  comments,
  onPlay,
  onSeek,
}: {
  track: Track;
  aura: TrackAura;
  isThis: boolean;
  isThisPlaying: boolean;
  isOwner: boolean;
  comments: Comment[];
  onPlay: () => void;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const perf = usePerfMode();

  const cover = art(track.artwork_url, 't500x500');
  const title = getDisplayTitle(track);
  const ad = getArtistDisplay(track);
  // Фиты показываются в feat-ряду (как и все кроме основного) — из
  // participants берём только remix/prod.
  const participants = getParticipants(track, ['remixer', 'producer']);
  const artistLinks = getArtistLinkItems(track);
  // Страница трека: в главной строке ТОЛЬКО основной, остальные — feat-ряд.
  const mainLink = artistLinks.slice(0, 1);
  const featLinks = artistLinks.slice(1);
  // Аватар и его клик — ОДИН человек: артист каталога, когда enrichment его
  // знает, иначе uploader. Раньше картинка была uploader'а, а клик вёл на
  // первого слинкованного из строки авторов.
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
  const hb = perf.blur(90);

  const titleStyle = aura.hasGenre
    ? {
        background: aura.aura.nameGradient,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 6px 22px rgba(0,0,0,0.5))',
      }
    : { color: 'rgba(255,255,255,0.96)', textShadow: '0 6px 22px rgba(0,0,0,0.5)' };

  return (
    <section
      className="relative rounded-[2rem] overflow-hidden glass-featured"
      style={{ isolation: 'isolate' }}
    >
      {cover && hb > 0 && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <img
            src={cover}
            alt=""
            className="w-full h-full object-cover scale-[1.4] opacity-[0.20]"
            style={{ filter: `blur(${hb}px) saturate(1.4)` }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(180deg, rgba(10,10,12,0.40), rgba(10,10,12,0.66))',
            }}
          />
        </div>
      )}

      <div className="relative p-6 md:p-8 flex flex-col gap-7">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-8">
          <TrackCover
            title={title}
            coverUrl={cover ?? undefined}
            aura={aura.aura}
            verified={ad.isEnriched && ad.verified}
            isPlaying={isThisPlaying}
            onToggle={onPlay}
          />

          <div className="flex-1 min-w-0 w-full text-center lg:text-left">
            <div className="flex items-center gap-2 flex-wrap justify-center lg:justify-start mb-3.5">
              <TrackStatusBadges meta={track._scd_meta} />
              {track.genre && (
                <span
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.06] text-white/55 border border-white/[0.06] uppercase tracking-[0.14em]"
                  style={{ color: aura.hasGenre ? aura.accent : undefined }}
                >
                  {track.genre}
                </span>
              )}
              {year && (
                <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] text-white/40 border border-white/[0.06] tabular-nums">
                  {year}
                </span>
              )}
              {albumTarget && album?.title && (
                <button
                  type="button"
                  onClick={() => navigate(albumTarget)}
                  title={t('track.openAlbum', { title: album.title })}
                  className="inline-flex items-center gap-1.5 max-w-[16rem] text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/[0.05] text-white/55 border border-white/[0.06] cursor-pointer transition-colors duration-200 hover:bg-white/[0.1] hover:text-white/90"
                >
                  <Disc3 size={11} className="shrink-0" />
                  <span className="truncate">{album.title}</span>
                </button>
              )}
            </div>

            <h1
              className="text-4xl md:text-6xl xl:text-7xl font-black leading-[0.95] tracking-tighter break-words"
              style={titleStyle}
            >
              {title}
            </h1>

            <div className="mt-4">
              <div className="inline-flex items-center gap-2.5 group/artist">
                {heroAvatarSrc && (
                  <img
                    src={art(heroAvatarSrc, 'small') ?? ''}
                    alt=""
                    className={`w-7 h-7 rounded-full ring-1 ring-white/[0.1] transition-all duration-200 ${
                      heroAvatarTarget ? 'cursor-pointer hover:ring-white/[0.22]' : ''
                    }`}
                    onClick={heroAvatarTarget ? () => navigate(heroAvatarTarget) : undefined}
                  />
                )}
                <span className="text-[15px] font-medium text-white/75">
                  <ArtistNameLinks
                    items={mainLink}
                    linkClassName="cursor-pointer transition-colors hover:text-white"
                  />
                </span>
                {ad.isEnriched && ad.verified && (
                  <span
                    className="text-[11px] text-emerald-400/80"
                    title={t('track.verifiedArtist', {
                      confidence: (ad.confidence ?? 0).toFixed(2),
                    })}
                  >
                    ✓
                  </span>
                )}
                {ad.isEnriched && !ad.verified && (
                  <span
                    className="text-[11px] text-amber-400/70"
                    title={t('track.unverifiedArtist', {
                      confidence: (ad.confidence ?? 0).toFixed(2),
                    })}
                  >
                    ?
                  </span>
                )}
                {ad.uploadKind && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider font-semibold ${
                      KIND_TONE[ad.uploadKind] ?? 'bg-white/[0.06] text-white/50'
                    }`}
                    title={t(`track.uploadKind.${ad.uploadKind}`)}
                  >
                    {t(`track.uploadKind.${ad.uploadKind}`)}
                  </span>
                )}
              </div>

              {(featLinks.length > 0 || participants || ad.uploader) && (
                <div className="mt-1.5 text-[12px] text-white/40 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 justify-center lg:justify-start">
                  {featLinks.length > 0 && (
                    <span>
                      {t('track.feat')}{' '}
                      <ArtistNameLinks
                        items={featLinks}
                        linkClassName="cursor-pointer text-white/55 hover:text-white/85 transition-colors"
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
                          className="text-white/55 hover:text-white/80 cursor-pointer transition-colors"
                          onClick={() => navigate(`/user/${encodeURIComponent(track.user.urn)}`)}
                        />,
                      ]}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center lg:justify-start">
              <TrackActionRail
                track={track}
                isPlaying={isThisPlaying}
                isOwner={isOwner}
                onPlay={onPlay}
              />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-white/[0.07]">
          <RoomFloor
            track={track}
            isCurrent={isThis}
            comments={comments}
            aura={aura}
            onSeek={onSeek}
          />
        </div>
      </div>
    </section>
  );
});
