import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Aura, auraRgba } from '../../lib/aura';
import { Users } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import { Avatar } from '../ui/Avatar';
import type { AlbumArtist } from './types';

interface AlbumCastProps {
  artists: AlbumArtist[];
  aura: Aura;
}

const ROLE_BUCKETS = ['primary', 'featured', 'remixer', 'producer'] as const;
const ROLE_LABEL_KEY: Record<string, string> = {
  primary: 'album.primaryArtist',
  featured: 'album.featured',
  remixer: 'album.remixer',
  producer: 'album.producer',
};

interface CastGroup {
  role: string;
  items: AlbumArtist[];
}

function groupByRole(artists: AlbumArtist[]): CastGroup[] {
  const map = new Map<string, AlbumArtist[]>();
  for (const a of artists) {
    const arr = map.get(a.role) ?? [];
    arr.push(a);
    map.set(a.role, arr);
  }
  const ordered: CastGroup[] = [];
  for (const k of ROLE_BUCKETS) {
    const items = map.get(k);
    if (items && items.length > 0) ordered.push({ role: k, items });
    map.delete(k);
  }
  for (const [k, items] of map) {
    if (items.length > 0) ordered.push({ role: k, items });
  }
  return ordered;
}

const CastCard = memo(function CastCard({
  artist,
  roleLabel,
  aura,
}: {
  artist: AlbumArtist;
  roleLabel: string;
  aura: Aura;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
      className="group relative flex items-center gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-500 hover:scale-[1.04]"
      style={{
        background: 'rgb(var(--ink) / 0.03)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      <span
        className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-ink/10 group-hover:ring-ink/30 transition-all duration-500"
        style={{ boxShadow: `0 8px 18px ${auraRgba(aura, 0.18)}` }}
      >
        <Avatar src={artist.avatar_url} alt={artist.name} size={48} />
      </span>
      <span className="min-w-0 flex flex-col leading-tight">
        <span className="text-[12px] font-semibold text-ink-90 truncate group-hover:text-ink">
          {artist.name}
        </span>
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-30">
          {roleLabel}
        </span>
      </span>
    </button>
  );
});

const CastRow = memo(function CastRow({
  role,
  items,
  aura,
}: {
  role: string;
  items: AlbumArtist[];
  aura: Aura;
}) {
  const { t } = useTranslation();
  const roleLabel = ROLE_LABEL_KEY[role] ? t(ROLE_LABEL_KEY[role]) : role;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-ink-30">
        {roleLabel} · {items.length}
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {items.map((artist) => (
          <CastCard key={artist.id} artist={artist} roleLabel={roleLabel} aura={aura} />
        ))}
      </div>
    </div>
  );
});

function AlbumCastImpl({ artists, aura }: AlbumCastProps) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const groups = useMemo(() => groupByRole(artists), [artists]);

  if (artists.length === 0) return null;

  const b = perf.blur(28);
  return (
    <div
      className="rounded-[2rem] p-5 md:p-7"
      style={{
        background:
            b > 0
                ? 'linear-gradient(180deg, rgb(var(--ink) / 0.035) 0%, rgb(var(--ink) / 0.015) 100%)'
                : 'rgb(var(--surface) / 0.85)',
        backdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
        WebkitBackdropFilter: b > 0 ? `blur(${b}px) saturate(160%)` : undefined,
        boxShadow:
          '0 30px 80px rgb(var(--shade) / calc(0.30 * var(--shade-alpha))), inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{
            background: auraRgba(aura, 0.12),
            boxShadow: `inset 0 0 0 1px ${auraRgba(aura, 0.25)}`,
          }}
        >
          <Users size={14} className="text-ink-70" />
        </span>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-60">
          {t('album.cast')}
          <span className="text-ink-25 ml-2">{artists.length}</span>
        </h3>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <CastRow key={g.role} role={g.role} items={g.items} aura={aura} />
        ))}
      </div>
    </div>
  );
}

export const AlbumCast = memo(AlbumCastImpl);
