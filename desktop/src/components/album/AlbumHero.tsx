import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Aura } from '../../lib/aura';
import { dur } from '../../lib/formatters';
import { Calendar, Check, Disc3, ListMusic, MicVocal } from '../../lib/icons';
import { PlaylistLikeBtn } from '../playlist/PlaylistActions';
import { Avatar } from '../ui/Avatar';
import { GlassHeroPanel } from '../ui/GlassHeroPanel';
import { InfoChip } from '../user/UserChips';
import { AlbumCoverArtifact } from './AlbumCoverArtifact';
import { AlbumPlayButton } from './AlbumPlayButton';
import { AlbumSaveButton } from './AlbumSaveButton';
import type { AlbumArtist, AlbumDetail } from './types';

interface AlbumHeroProps {
  album: AlbumDetail;
  hasStar: boolean;
  aura: Aura;
}

const ROLE_LABEL_KEY: Record<string, string> = {
  primary: 'album.primaryArtist',
  featured: 'album.featured',
  remixer: 'album.remixer',
  producer: 'album.producer',
};

const ArtistChip = memo(function ArtistChip({
  id,
  name,
  role,
  avatarUrl,
}: {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isPrimary = role === 'primary';
  const subLabel = ROLE_LABEL_KEY[role] ? t(ROLE_LABEL_KEY[role]) : role;
  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(id)}`)}
      className={`group inline-flex cursor-pointer items-center gap-2.5 rounded-full py-1 pl-1 pr-3.5 ring-1 transition-colors duration-200 hover:bg-ink/[0.08] ${isPrimary ? 'bg-ink/[0.07] ring-ink/20' : 'bg-ink/[0.04] ring-ink/10'}`}
    >
      <span className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-ink/15">
        <Avatar src={avatarUrl} alt={name} size={28} />
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[12px] font-semibold text-ink-90 group-hover:text-ink">{name}</span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-35">
          {subLabel}
        </span>
      </span>
    </button>
  );
});

function AlbumHeroImpl({ album, hasStar, aura }: AlbumHeroProps) {
  const { t } = useTranslation();
  const kind = (album.type ?? 'album').toLowerCase();
  const kindLabel = t(`artist.kind.${kind}`, { defaultValue: kind });

  const { totalDuration, indexedCount, featured } = useMemo(() => {
    let total = 0;
    let indexed = 0;
    const feat: AlbumArtist[] = [];
    for (const tr of album.tracks) {
      total += tr.duration ?? 0;
      if (tr.enrichment?.availability !== 'wanted') indexed++;
    }
    for (const a of album.artists) if (a.role !== 'primary') feat.push(a);
    return { totalDuration: total, indexedCount: indexed, featured: feat };
  }, [album.tracks, album.artists]);

  return (
    <GlassHeroPanel className="@container">
      <div
        data-ui="album-hero"
        className="relative p-6 @min-[512px]:p-10 flex flex-col @min-[740px]:flex-row gap-8 @min-[740px]:gap-12 items-center @min-[740px]:items-start"
      >
        <AlbumCoverArtifact
          title={album.title}
          coverUrl={album.cover_url}
          hasStar={hasStar}
          aura={aura}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-5 text-center @min-[740px]:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center @min-[740px]:justify-start">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.05] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-70 ring-1 ring-ink/10">
              <Disc3 size={11} /> {kindLabel}
            </span>
            {album.confidence >= 0.7 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-ok/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ok ring-1 ring-ok/25">
                <Check size={11} /> {t('album.verified')}
              </span>
            )}
          </div>

          <h1
            className="text-5xl @min-[512px]:text-7xl font-black leading-[0.85] tracking-tighter wrap-break-word max-w-full"
            style={
              hasStar
                ? {
                    background: aura.nameGradient,
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }
                : { color: 'rgb(var(--ink))' }
            }
          >
            {album.title}
          </h1>

          {(album.primary_artist || featured.length > 0) && (
            <div className="flex flex-wrap gap-2 justify-center @min-[740px]:justify-start items-center">
              {album.primary_artist && (
                <ArtistChip
                  id={album.primary_artist.id}
                  name={album.primary_artist.name}
                  role="primary"
                  avatarUrl={album.primary_artist.avatar_url}
                />
              )}
              {featured.map((a) => (
                <ArtistChip
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  role={a.role}
                  avatarUrl={a.avatar_url}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-center @min-[740px]:justify-start">
            {album.release_year && (
              <InfoChip icon={<Calendar size={11} />}>{album.release_year}</InfoChip>
            )}
            <InfoChip icon={<ListMusic size={11} />}>
              {t('album.tracksCount', { count: album.tracks.length })}
            </InfoChip>
            {totalDuration > 0 && (
              <InfoChip icon={<MicVocal size={11} />}>{dur(totalDuration)}</InfoChip>
            )}
            {indexedCount < album.tracks.length && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink ring-1 ring-accent/30">
                {t('album.availability', {
                  indexed: indexedCount,
                  total: album.tracks.length,
                })}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 justify-center @min-[740px]:justify-start">
            <AlbumPlayButton tracks={album.tracks} />
            {album.sc_playlist_urn && <PlaylistLikeBtn playlistUrn={album.sc_playlist_urn} />}
            <AlbumSaveButton album={album} />
          </div>
        </div>
      </div>
    </GlassHeroPanel>
  );
}

export const AlbumHero = memo(AlbumHeroImpl);
