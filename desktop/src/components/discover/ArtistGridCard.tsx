import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {auraRgba, resolveAura} from '../../lib/aura';
import type { CatalogArtist } from '../../lib/discover';
import { art, fc } from '../../lib/formatters';
import { Check, Disc3, Globe, Headphones, MicVocal, Star } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {useViewerAura} from '../../lib/useViewerAura';
import { gradientForId, monogramOf } from './visuals';

interface ArtistGridCardProps {
  artist: CatalogArtist;
}

function ArtistGridCardImpl({ artist }: ArtistGridCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
    const perf = usePerfMode();
    const viewerAura = useViewerAura();
  const aura = useMemo(
    () =>
      artist.star && artist.aura_id
        ? resolveAura(artist.aura_id, artist.custom_hex ?? null)
          : viewerAura,
      [artist.aura_id, artist.custom_hex, artist.star, viewerAura],
  );
  const initials = monogramOf(artist.name);
  const [g1, g2, g3] = useMemo(() => gradientForId(artist.id), [artist.id]);
  const verified = artist.confidence >= 0.7;
    const cardBlur = perf.blur(20);

  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
      className="group relative h-full w-full flex flex-col items-center gap-3 p-5 rounded-3xl cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.03] overflow-hidden"
      style={{
          background: cardBlur > 0 ? 'rgba(255,255,255,0.03)' : 'rgba(22,22,27,0.92)',
        border: '0.5px solid rgba(255,255,255,0.06)',
          backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px) saturate(140%)` : undefined,
          WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px) saturate(140%)` : undefined,
      }}
    >
        {perf.bloom && (
            <div
                className={`absolute -inset-x-12 -top-20 h-44 pointer-events-none group-hover:opacity-90 transition-opacity duration-700 ${
                    perf.mode === 'beauty' ? 'opacity-30' : 'opacity-0'
                }`}
                style={{
                    background: `radial-gradient(60% 60% at 50% 50%, ${auraRgba(aura, 0.55)}, transparent 70%)`,
                    filter: `blur(${perf.blur(50)}px)`,
                    mixBlendMode: 'screen',
                }}
            />
        )}

      <div className="relative w-[96px] h-[96px]">
        {artist.star && (
          <div
            className="absolute -inset-[4px] rounded-full pointer-events-none overflow-hidden"
            style={{
              padding: '2px',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              filter: `drop-shadow(0 0 12px ${aura.orbs[0]}aa)`,
            }}
          >
            <div
              className="absolute -inset-[40%]"
              style={{
                background: `conic-gradient(from 0deg, ${aura.orbs[0]}, ${aura.orbs[1]}, ${aura.orbs[2]}, ${aura.orbs[0]})`,
                  animation: perf.idleAnim ? 'ring-rotate 12s linear infinite' : undefined,
              }}
            />
          </div>
        )}
        <div
          className="relative w-full h-full rounded-full overflow-hidden ring-1 ring-white/15 group-hover:ring-white/30 transition-all duration-500"
          style={{
            boxShadow: `0 12px 28px ${auraRgba(aura, 0.35)}`,
            background: `linear-gradient(135deg, ${g1} 0%, ${g2} 50%, ${g3} 100%)`,
          }}
        >
          {artist.avatar_url ? (
            <img
              src={art(artist.avatar_url, 't300x300') ?? undefined}
              alt={artist.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.08]"
              decoding="async"
              loading="lazy"
              draggable={false}
              width={300}
              height={300}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-white/95 font-black tracking-tight select-none"
                style={{
                  fontSize: 'clamp(28px, 3vw, 36px)',
                  textShadow: '0 6px 18px rgba(0,0,0,0.5)',
                }}
              >
                {initials}
              </span>
            </div>
          )}
          {artist.star && (
            <div
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${auraRgba(aura, 0.65)}, ${auraRgba(aura, 0.15)})`,
                boxShadow: `0 0 12px ${auraRgba(aura, 0.6)}, inset 0 0 0 1px ${auraRgba(aura, 0.7)}`,
              }}
            >
              <Star size={11} className="text-white" fill="currentColor" />
            </div>
          )}
        </div>
      </div>

      <div className="text-center min-w-0 w-full relative flex flex-col gap-1">
        <div className="flex items-center justify-center gap-1.5 min-w-0">
          <p className="text-[14px] font-bold text-white/95 truncate group-hover:text-white">
            {artist.name}
          </p>
          {verified && (
            <span
              className="shrink-0 w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center shadow-[0_0_8px_rgba(59,130,246,0.55)]"
              title={t('track.verifiedArtist', { confidence: artist.confidence.toFixed(2) })}
            >
              <Check size={8} className="text-white" strokeWidth={3.5} />
            </span>
          )}
        </div>
        {artist.country && (
          <p className="inline-flex items-center justify-center gap-1 text-[10px] text-white/35">
            <Globe size={9} /> {artist.country}
          </p>
        )}
      </div>

      {artist.tags.length > 0 && (
        <div className="relative flex flex-wrap justify-center gap-1">
          {artist.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.18em] text-white/55"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '0.5px solid rgba(255,255,255,0.08)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="relative w-full flex items-center justify-center gap-1.5 pt-1">
        <Stat
          icon={<MicVocal size={10} />}
          value={artist.track_count_primary}
          label={t('artist.tracks')}
        />
        {artist.track_count_featured > 0 && (
          <Stat
            icon={<Star size={10} />}
            value={artist.track_count_featured}
            label={t('artist.featured')}
          />
        )}
        <Stat icon={<Disc3 size={10} />} value={artist.album_count} label={t('artist.albums')} />
      </div>

      <div className="relative w-full">
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div
            className="h-full rounded-full"
            style={{
                width: `${Math.round(artist.popularity * 100)}%`,
              background: `linear-gradient(90deg, ${aura.orbs[0]}, ${aura.orbs[1]})`,
              boxShadow: `0 0 10px ${auraRgba(aura, 0.5)}`,
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">
          <span className="inline-flex items-center gap-1">
            <Headphones size={9} className="text-white/30" />
            {fc(artist.monthly_listeners)}
          </span>
          <span style={{ color: auraRgba(aura, 0.9) }}>
            {t('discover.trendValue', {value: Math.round(artist.popularity * 100)})}
          </span>
        </div>
      </div>
    </button>
  );
}

const Stat = memo(function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] tabular-nums text-white/55"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '0.5px solid rgba(255,255,255,0.06)',
      }}
      title={label}
    >
      <span className="text-white/40">{icon}</span>
      <span className="font-bold text-white/85">{value}</span>
    </span>
  );
});

export const ArtistGridCard = memo(ArtistGridCardImpl);
