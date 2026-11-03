import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {type Aura, auraRgba, resolveAura} from '../../lib/aura';
import { type CatalogAlbum, type CatalogArtist, useDiscoverSpotlight } from '../../lib/discover';
import { dur, fc } from '../../lib/formatters';
import { Disc3, Headphones, ListMusic, Sparkles, Star } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import {useViewerAura} from '../../lib/useViewerAura';
import { HorizontalScroll } from '../ui/HorizontalScroll';
import { Skeleton } from '../ui/Skeleton';
import { SyncNotice } from '../ui/SyncNotice';
import { gradientForId, monogramOf } from './visuals';

interface DiscoverSpotlightProps {
  aura: Aura;
}

function DiscoverSpotlightImpl({ aura }: DiscoverSpotlightProps) {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useDiscoverSpotlight();
  const items = data?.items ?? [];
  const isFailed = isError && items.length === 0;

  if (!isLoading && !isFailed && items.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-1">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${auraRgba(aura, 0.28)}, ${auraRgba(aura, 0.04)})`,
            boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.4)}`,
          }}
        >
          <Sparkles size={14} className="text-ink-85" />
        </span>
        <h2 className="text-[15px] font-bold text-ink-95 tracking-tight">
          {t('discover.spotlightTitle')}
          {items.length > 0 && (
            <span className="ml-2 text-[11px] font-bold tabular-nums text-ink-30">
              {items.length}
            </span>
          )}
        </h2>
      </div>

      {isLoading ? (
        <HorizontalScroll className="px-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="shrink-0 w-[280px] h-[360px] rounded-[1.75rem]" />
          ))}
        </HorizontalScroll>
      ) : isFailed ? (
        <div className="py-8">
          <SyncNotice kind="failed" onRetry={() => void refetch()} />
        </div>
      ) : (
        <HorizontalScroll className="px-1">
          {items.map((it) =>
            it.kind === 'album' ? (
              <AlbumSpotlightCard key={`al-${it.album.id}`} album={it.album} aura={aura} />
            ) : (
              <ArtistSpotlightCard key={`ar-${it.artist.id}`} artist={it.artist} />
            ),
          )}
        </HorizontalScroll>
      )}
    </section>
  );
}

const AlbumSpotlightCard = memo(function AlbumSpotlightCard({
  album,
  aura,
}: {
  album: CatalogAlbum;
  aura: Aura;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
    const perf = usePerfMode();
  const initials = monogramOf(album.title);
  const [g1, g2, g3] = useMemo(() => gradientForId(album.id, 3), [album.id]);
  const kindLabel = t(`artist.kind.${album.type}`, { defaultValue: album.type });
    const badgeBlur = perf.blur(12);

  return (
    <button
      type="button"
      onClick={() => navigate(`/album/${encodeURIComponent(album.id)}`)}
      className="group relative shrink-0 w-[280px] h-[360px] rounded-[1.75rem] cursor-pointer overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.02]"
      style={{
        background: `linear-gradient(160deg, ${g1} 0%, ${g2} 60%, ${g3} 100%)`,
        boxShadow:
          '0 30px 60px rgb(var(--shade) / calc(0.55 * var(--shade-alpha))), inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.18)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(80% 50% at 50% 0%, rgb(var(--ink) / 0.22) 0%, transparent 60%)',
          mixBlendMode: 'overlay',
        }}
      />
        {perf.bloom && (
            <div
                className="absolute -inset-x-20 -bottom-32 h-64 pointer-events-none opacity-70"
                style={{
                    background: `radial-gradient(60% 50% at 50% 50%, ${g1}, transparent 70%)`,
                    filter: `blur(${perf.blur(40)}px)`,
                    mixBlendMode: 'screen',
                }}
            />
        )}

      {album.cover_url ? (
        <img
          src={album.cover_url}
          alt={album.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-1000 group-hover:scale-[1.05]"
          decoding="async"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-ink-95 font-black tracking-tight select-none"
            style={{
              fontSize: 'clamp(96px, 9vw, 132px)',
              textShadow: '0 16px 36px rgba(0,0,0,0.5)',
            }}
          >
            {initials}
          </span>
        </div>
      )}

      <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-[0.22em] text-ink-95"
          style={{
              background: badgeBlur > 0 ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.66)',
              backdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : undefined,
              WebkitBackdropFilter: badgeBlur > 0 ? `blur(${badgeBlur}px)` : undefined,
            border: '0.5px solid rgb(var(--ink) / 0.12)',
          }}
        >
          <Disc3 size={10} /> {kindLabel}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col gap-2 text-left">
        <div
          className="absolute inset-x-0 bottom-0 top-[-40px] pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.7) 100%)',
          }}
        />
        <p
          className="relative text-[10px] font-bold uppercase tracking-[0.28em] text-ink-85"
          style={{ textShadow: '0 4px 12px rgba(0,0,0,0.7)' }}
        >
          {album.primary_artist.name}
        </p>
        <p
          className="relative text-[22px] font-black leading-[0.95] text-ink tracking-tight"
          style={{ textShadow: '0 6px 20px rgba(0,0,0,0.65)' }}
        >
          {album.title}
        </p>
        <div className="relative flex items-center gap-2 text-[10px] text-ink-75 tabular-nums">
          <span className="inline-flex items-center gap-1">
            <ListMusic size={10} /> {album.track_count}
          </span>
          {album.total_duration_ms > 0 && (
            <>
              <span className="text-ink-35">·</span>
              <span>{dur(album.total_duration_ms)}</span>
            </>
          )}
          {album.release_year && (
            <>
              <span className="text-ink-35">·</span>
              <span>{album.release_year}</span>
            </>
          )}
        </div>
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.5)}, inset 0 0 60px ${auraRgba(aura, 0.25)}`,
        }}
      />
    </button>
  );
});

const ArtistSpotlightCard = memo(function ArtistSpotlightCard({
  artist,
}: {
  artist: CatalogArtist;
}) {
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

  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
      className="group relative shrink-0 w-[280px] h-[360px] rounded-[1.75rem] cursor-pointer overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:scale-[1.02]"
      style={{
        background: `radial-gradient(140% 90% at 30% 10%, ${auraRgba(aura, 0.55)} 0%, rgb(var(--surface) / 0.92) 65%, rgb(var(--paper) / 0.95) 100%)`,
        boxShadow:
          '0 30px 60px rgb(var(--shade) / calc(0.55 * var(--shade-alpha))), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.10)',
      }}
    >
        {perf.bloom && (
            <div
                className="absolute -inset-x-24 -top-32 h-72 pointer-events-none opacity-80"
                style={{
                    background: `radial-gradient(55% 55% at 50% 50%, ${auraRgba(aura, 0.65)}, transparent 70%)`,
                    filter: `blur(${perf.blur(48)}px)`,
                    mixBlendMode: 'screen',
                }}
            />
        )}
        {perf.bloom && (
            <div
                className="absolute inset-x-0 top-0 h-44 pointer-events-none opacity-40"
                style={{
                    background: `conic-gradient(from 220deg at 50% 0%, ${aura.orbs[0]}, ${aura.orbs[1]}, ${aura.orbs[2]}, ${aura.orbs[0]})`,
                    filter: `blur(${perf.blur(60)}px)`,
                    mixBlendMode: 'screen',
                    animation: perf.idleAnim ? 'ring-rotate 30s linear infinite' : undefined,
                }}
            />
        )}

      <div className="relative flex flex-col items-center pt-10 px-6">
        <div className="relative w-[120px] h-[120px]">
          {artist.star && (
            <div
              className="absolute -inset-[5px] rounded-full pointer-events-none overflow-hidden"
              style={{
                padding: '2px',
                WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                WebkitMaskComposite: 'xor',
                maskComposite: 'exclude',
                filter: `drop-shadow(0 0 14px ${aura.orbs[0]}cc)`,
              }}
            >
              <div
                className="absolute -inset-[40%]"
                style={{
                  background: `conic-gradient(from 0deg, ${aura.orbs[0]}, ${aura.orbs[1]}, ${aura.orbs[2]}, ${aura.orbs[0]})`,
                    animation: perf.idleAnim ? 'ring-rotate 10s linear infinite' : undefined,
                }}
              />
            </div>
          )}
          <div
            className="relative w-full h-full rounded-full overflow-hidden ring-1 ring-ink/15"
            style={{
              background: `linear-gradient(135deg, ${g1} 0%, ${g2} 50%, ${g3} 100%)`,
              boxShadow: `0 20px 40px ${auraRgba(aura, 0.5)}, inset 0 0 0 1px rgba(255,255,255,0.12)`,
            }}
          >
            {artist.avatar_url ? (
              <img
                src={artist.avatar_url}
                alt={artist.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                decoding="async"
                loading="lazy"
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span
                  className="text-ink-95 font-black tracking-tight select-none"
                  style={{
                    fontSize: 'clamp(36px, 4vw, 44px)',
                    textShadow: '0 6px 18px rgba(0,0,0,0.5)',
                  }}
                >
                  {initials}
                </span>
              </div>
            )}
          </div>
          {artist.star && (
            <div
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${auraRgba(aura, 0.75)}, ${auraRgba(aura, 0.2)})`,
                boxShadow: `0 0 16px ${auraRgba(aura, 0.7)}, inset 0 0 0 1.5px ${auraRgba(aura, 0.85)}`,
              }}
            >
              <Star size={13} className="text-ink" fill="currentColor" />
            </div>
          )}
        </div>

        <p
          className="mt-5 text-[20px] font-black leading-tight tracking-tight text-ink text-center truncate w-full"
          style={{ textShadow: '0 6px 20px rgba(0,0,0,0.6)' }}
        >
          {artist.name}
        </p>
        {artist.country && (
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-ink-45">
            {artist.country}
          </p>
        )}

        {artist.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {artist.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.2em] text-ink-70"
                style={{
                  background: 'rgb(var(--ink) / 0.06)',
                  border: '0.5px solid rgb(var(--ink) / 0.10)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold tabular-nums text-ink-65">
          <Headphones size={11} className="text-ink-55" />
          {fc(artist.monthly_listeners)}
        </span>
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold tabular-nums px-2.5 py-1 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${auraRgba(aura, 0.32)}, ${auraRgba(aura, 0.05)})`,
            color: 'rgb(var(--ink))',
            boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.4)}`,
          }}
        >
          {t('discover.trendValue', {value: Math.round(artist.popularity * 100)})}
        </span>
      </div>

      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.55)}, inset 0 0 70px ${auraRgba(aura, 0.3)}`,
        }}
      />
    </button>
  );
});

export const DiscoverSpotlight = memo(DiscoverSpotlightImpl);
