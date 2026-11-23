import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Users } from '../../lib/icons';
import { Avatar } from '../ui/Avatar';
import type { AlbumArtist } from './types';

interface AlbumCastProps {
  artists: AlbumArtist[];
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
}: {
  artist: AlbumArtist;
  roleLabel: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(artist.id)}`)}
      className="group relative flex cursor-pointer items-center gap-3 rounded-2xl bg-ink/[0.03] p-2.5 ring-1 ring-ink/[0.07] transition-colors duration-200 hover:bg-ink/[0.07]"
    >
      <span
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-1 ring-ink/10"
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
}: {
  role: string;
  items: AlbumArtist[];
}) {
  const { t } = useTranslation();
  const roleLabel = ROLE_LABEL_KEY[role] ? t(ROLE_LABEL_KEY[role]) : role;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[9px] font-bold uppercase tracking-[0.28em] text-ink-30">
        {roleLabel} · {items.length}
      </span>
      <div className="grid grid-cols-2 @min-[384px]:grid-cols-3 @min-[512px]:grid-cols-4 @min-[740px]:grid-cols-5 @min-[960px]:grid-cols-6 gap-3">
        {items.map((artist) => (
          <CastCard key={artist.id} artist={artist} roleLabel={roleLabel} />
        ))}
      </div>
    </div>
  );
});

function AlbumCastImpl({ artists }: AlbumCastProps) {
  const { t } = useTranslation();
  const groups = useMemo(() => groupByRole(artists), [artists]);

  if (artists.length === 0) return null;

  return (
    <div className="panel p-5 @min-[512px]:p-7">
      <div className="flex items-center gap-3 mb-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink/[0.05]">
          <Users size={14} className="text-ink-70" />
        </span>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-ink-60">
          {t('album.cast')}
          <span className="text-ink-25 ml-2">{artists.length}</span>
        </h3>
      </div>

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <CastRow key={g.role} role={g.role} items={g.items} />
        ))}
      </div>
    </div>
  );
}

export const AlbumCast = memo(AlbumCastImpl);
