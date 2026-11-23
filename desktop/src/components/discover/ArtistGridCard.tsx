import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { resolveAura } from '../../lib/aura';
import type { CatalogArtist } from '../../lib/discover';
import { fc } from '../../lib/formatters';
import { Check, Disc3, Globe, Headphones, MicVocal, Star, User } from '../../lib/icons';

function ArtistGridCardImpl({ artist }: { artist: CatalogArtist }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const verified = artist.confidence >= 0.7;

  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
      className="group flex h-full w-full cursor-pointer flex-col items-center rounded-2xl px-3 pt-4 pb-3 text-center transition-colors duration-200 hover:bg-ink/[0.035]"
    >
      <ArtistAvatar artist={artist} />

      <div className="mt-3 flex w-full min-w-0 items-center justify-center gap-1.5">
        <p className="truncate text-[14px] font-semibold text-ink-90 transition-colors group-hover:text-ink">
          {artist.name}
        </p>
        {verified && (
          <span
            className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-blue-500"
            title={t('track.verifiedArtist', { confidence: artist.confidence.toFixed(2) })}
          >
            <Check size={8} className="text-white" strokeWidth={3.5} />
          </span>
        )}
      </div>

      <p className="mt-1 flex items-center justify-center gap-2.5 text-[11px] tabular-nums text-ink-40">
        <span className="inline-flex items-center gap-1">
          <Headphones size={10} className="text-ink-30" />
          {fc(artist.monthly_listeners)}
        </span>
        {artist.country && (
          <span className="inline-flex items-center gap-1">
            <Globe size={10} className="text-ink-30" />
            {artist.country}
          </span>
        )}
      </p>

      {artist.tags.length > 0 && (
        <div className="mt-2.5 flex max-w-full flex-wrap justify-center gap-1 overflow-hidden">
          {artist.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="truncate rounded-full bg-ink/[0.05] px-2 py-0.5 text-[10px] font-medium text-ink-55"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-center gap-3 pt-3 text-[10.5px] tabular-nums text-ink-45">
        <Fact
          icon={<MicVocal size={10} />}
          value={artist.track_count_primary}
          label={t('artist.tracks')}
        />
        {artist.track_count_featured > 0 && (
          <Fact
            icon={<Star size={10} />}
            value={artist.track_count_featured}
            label={t('artist.featured')}
          />
        )}
        <Fact icon={<Disc3 size={10} />} value={artist.album_count} label={t('artist.albums')} />
        <span className="text-ink-30">
          {t('discover.trendValue', { value: Math.round(artist.popularity * 100) })}
        </span>
      </div>
    </button>
  );
}

function ArtistAvatar({ artist }: { artist: CatalogArtist }) {
  const ring = useMemo(
    () =>
      artist.star && artist.aura_id
        ? resolveAura(artist.aura_id, artist.custom_hex ?? null).orbs
        : null,
    [artist.aura_id, artist.custom_hex, artist.star],
  );
  return (
    <div className="relative h-[92px] w-[92px] shrink-0">
      {ring && (
        <div
          className="absolute -inset-[5px] rounded-full p-[2px]"
          style={{
            background: `conic-gradient(from 200deg, ${ring[0]}, ${ring[1]}, ${ring[2]}, ${ring[0]})`,
            WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}
      <div className="relative h-full w-full overflow-hidden rounded-full bg-ink/[0.05] ring-1 ring-ink/[0.08] transition-shadow duration-300 group-hover:ring-ink/20">
        {artist.avatar_url ? (
          <img
            src={artist.avatar_url}
            alt=""
            className="h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <User size={26} className="text-ink-20" />
          </div>
        )}
      </div>
      {artist.star && (
        <span
          data-scheme="dark"
          className="absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-accent"
        >
          <Star size={11} fill="currentColor" />
        </span>
      )}
    </div>
  );
}

const Fact = memo(function Fact({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1" title={label}>
      <span className="text-ink-30">{icon}</span>
      <span className="font-semibold text-ink-70">{fc(value)}</span>
    </span>
  );
});

export const ArtistGridCard = memo(ArtistGridCardImpl);
