import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Aura, auraRgba } from '../../lib/aura';
import type { CatalogAlbum } from '../../lib/discover';
import { art, dur } from '../../lib/formatters';
import { Disc3, ListMusic, Star } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import { gradientForId, monogramOf } from './visuals';

interface AlbumGridCardProps {
  album: CatalogAlbum;
  aura: Aura;
}

function AlbumGridCardImpl({ album, aura }: AlbumGridCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
    const perf = usePerfMode();
  const kindLabel = t(`artist.kind.${album.type}`, { defaultValue: album.type });
  const initials = monogramOf(album.title);
  const [g1, g2, g3] = useMemo(() => gradientForId(album.id, 3), [album.id]);
    const cardBlur = perf.blur(20);
    const badgeBlur = perf.blur(12);
    const discBlur = perf.blur(10);

  return (
    <button
      type="button"
      onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
      className="group relative h-full w-full flex flex-col gap-3 text-left p-3 rounded-3xl cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.03] overflow-hidden"
      style={{
          background: cardBlur > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(22,22,27,0.92)',
        border: '0.5px solid rgba(255,255,255,0.06)',
          backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px) saturate(140%)` : undefined,
          WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px) saturate(140%)` : undefined,
      }}
    >
        {perf.bloom && (
            <div
                className="absolute -inset-x-10 -top-16 h-32 pointer-events-none opacity-0 group-hover:opacity-80 transition-opacity duration-700"
                style={{
                    background: `radial-gradient(60% 80% at 50% 50%, ${g1}80, transparent 70%)`,
                    filter: `blur(${perf.blur(40)}px)`,
                    mixBlendMode: 'screen',
                }}
            />
        )}

      <div
        className="relative aspect-square rounded-2xl overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${g1} 0%, ${g2} 55%, ${g3} 100%)`,
          boxShadow: `0 20px 40px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.18)`,
        }}
      >
        {album.cover_url ? (
          <img
            src={art(album.cover_url, 't300x300') ?? undefined}
            alt={album.title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
            decoding="async"
            loading="lazy"
            draggable={false}
            width={300}
            height={300}
          />
        ) : (
          <>
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(120% 80% at 30% 10%, rgba(255,255,255,0.20) 0%, transparent 60%)',
                mixBlendMode: 'overlay',
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-white/95 font-black tracking-tight select-none"
                style={{
                  fontSize: 'clamp(40px, 5vw, 64px)',
                  textShadow: '0 8px 24px rgba(0,0,0,0.55)',
                }}
              >
                {initials}
              </span>
            </div>
            <div
              className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                  background: discBlur > 0 ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.6)',
                  backdropFilter: discBlur > 0 ? `blur(${discBlur}px)` : undefined,
                  WebkitBackdropFilter: discBlur > 0 ? `blur(${discBlur}px)` : undefined,
                border: '0.5px solid rgba(255,255,255,0.16)',
              }}
            >
              <Disc3 size={14} className="text-white/70" />
            </div>
          </>
        )}

        <div
          className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.18em]"
          style={{
              background: badgeBlur > 0 ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.72)',
            color: '#fff',
              backdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : undefined,
              WebkitBackdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : undefined,
            border: '0.5px solid rgba(255,255,255,0.12)',
          }}
        >
          {kindLabel}
        </div>
        {album.star && (
          <div
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${auraRgba(aura, 0.6)}, ${auraRgba(aura, 0.15)})`,
              boxShadow: `0 0 12px ${auraRgba(aura, 0.6)}, inset 0 0 0 1px ${auraRgba(aura, 0.7)}`,
            }}
          >
            <Star size={11} className="text-white" fill="currentColor" />
          </div>
        )}
      </div>

      <div className="px-1 min-w-0 flex flex-col gap-1">
        <p className="text-[13.5px] font-semibold text-white/90 truncate group-hover:text-white">
          {album.title}
        </p>
        <p className="text-[11px] text-white/45 truncate">{album.primary_artist.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="inline-flex items-center gap-1 text-[10px] tabular-nums text-white/30">
            <ListMusic size={10} /> {album.track_count}
          </span>
          {album.total_duration_ms > 0 && (
            <>
              <span className="text-white/15">·</span>
              <span className="text-[10px] tabular-nums text-white/30">
                {dur(album.total_duration_ms)}
              </span>
            </>
          )}
          {album.release_year != null && (
            <>
              <span className="text-white/15">·</span>
              <span className="text-[10px] tabular-nums text-white/30">{album.release_year}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

export const AlbumGridCard = memo(AlbumGridCardImpl);
