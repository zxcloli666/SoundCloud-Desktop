import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Aura, auraRgba } from '../../lib/aura';
import { dur } from '../../lib/formatters';
import { Calendar, Check, Disc3, ListMusic, MicVocal } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
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
  aura,
}: {
  id: string;
  name: string;
  role: string;
  avatarUrl?: string;
  aura: Aura;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
    const b = usePerfMode().blur(16);
  const isPrimary = role === 'primary';
  const subLabel = ROLE_LABEL_KEY[role] ? t(ROLE_LABEL_KEY[role]) : role;
  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(id)}`)}
      className="group inline-flex items-center gap-2.5 pl-1 pr-3.5 py-1 rounded-full cursor-pointer transition-all duration-300 hover:scale-105"
      style={{
        background: isPrimary
          ? `linear-gradient(135deg, ${auraRgba(aura, 0.18)}, ${auraRgba(aura, 0.04)})`
            : b > 0
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(28,28,32,0.85)',
        boxShadow: isPrimary
          ? `inset 0 0 0 1px ${auraRgba(aura, 0.35)}`
          : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
          backdropFilter: b > 0 ? `blur(${b}px)` : undefined,
          WebkitBackdropFilter: b > 0 ? `blur(${b}px)` : undefined,
      }}
    >
      <span className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-white/15">
        <Avatar src={avatarUrl} alt={name} size={28} />
      </span>
      <span className="flex flex-col items-start leading-tight">
        <span className="text-[12px] font-semibold text-white/90 group-hover:text-white">
          {name}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/35">
          {subLabel}
        </span>
      </span>
    </button>
  );
});

function AlbumHeroImpl({ album, hasStar, aura }: AlbumHeroProps) {
  const { t } = useTranslation();
    const perf = usePerfMode();
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
    <GlassHeroPanel hasStar={hasStar} aura={aura}>
        {album.cover_url &&
            perf.bloom &&
            (() => {
                const hb = perf.blur(50);
                return (
                    <div
                        className="absolute -top-10 left-6 md:left-10 w-[220px] h-[220px] md:w-[280px] md:h-[280px] pointer-events-none rounded-[3rem] overflow-hidden opacity-50"
                        style={{
                            filter: `blur(${hb}px)`,
                            transform: 'translateZ(0)',
                            contain: 'strict',
                        }}
                    >
                        <img
                            src={album.cover_url}
                            alt=""
                            className="w-full h-full object-cover scale-150"
                            decoding="async"
                        />
                    </div>
                );
            })()}

      <div className="relative p-6 md:p-10 flex flex-col lg:flex-row gap-8 lg:gap-12 items-center lg:items-start">
        <AlbumCoverArtifact
          title={album.title}
          coverUrl={album.cover_url}
          hasStar={hasStar}
          aura={aura}
        />

        <div className="flex-1 min-w-0 flex flex-col gap-5 text-center lg:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{
                background: hasStar
                  ? `linear-gradient(135deg, ${auraRgba(aura, 0.25)}, ${auraRgba(aura, 0.08)})`
                    : perf.blur(12) > 0
                        ? 'rgba(255,255,255,0.05)'
                        : 'rgba(28,28,32,0.85)',
                color: hasStar ? '#fff' : 'rgba(255,255,255,0.7)',
                boxShadow: hasStar
                  ? `inset 0 0 0 1px ${auraRgba(aura, 0.4)}`
                  : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  backdropFilter: perf.blur(12) > 0 ? `blur(${perf.blur(12)}px)` : undefined,
                  WebkitBackdropFilter: perf.blur(12) > 0 ? `blur(${perf.blur(12)}px)` : undefined,
              }}
            >
              <Disc3 size={11} /> {kindLabel}
            </span>
            {album.confidence >= 0.7 && (
              <span
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300"
                style={{
                  background: 'rgba(16,185,129,0.08)',
                  boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.22)',
                }}
              >
                <Check size={11} /> {t('album.verified')}
              </span>
            )}
          </div>

          <h1
            className="text-5xl md:text-7xl font-black leading-[0.85] tracking-tighter wrap-break-word max-w-full"
            style={
              hasStar
                ? {
                    background: aura.nameGradient,
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                      animation: perf.idleAnim ? 'prismatic-shift 6s linear infinite' : undefined,
                    filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.5))',
                  }
                : { color: '#fff', textShadow: '0 8px 24px rgba(0,0,0,0.5)' }
            }
          >
            {album.title}
          </h1>

          {(album.primary_artist || featured.length > 0) && (
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start items-center">
              {album.primary_artist && (
                <ArtistChip
                  id={album.primary_artist.id}
                  name={album.primary_artist.name}
                  role="primary"
                  avatarUrl={album.primary_artist.avatar_url}
                  aura={aura}
                />
              )}
              {featured.map((a) => (
                <ArtistChip
                  key={a.id}
                  id={a.id}
                  name={a.name}
                  role={a.role}
                  avatarUrl={a.avatar_url}
                  aura={aura}
                />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
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
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.16em]"
                style={{
                  background: auraRgba(aura, 0.12),
                  color: '#fff',
                  boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.3)}`,
                }}
              >
                {t('album.availability', {
                  indexed: indexedCount,
                  total: album.tracks.length,
                })}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1 justify-center lg:justify-start">
            <AlbumPlayButton tracks={album.tracks} aura={aura} />
            <AlbumSaveButton album={album} />
          </div>
        </div>
      </div>
    </GlassHeroPanel>
  );
}

export const AlbumHero = memo(AlbumHeroImpl);
