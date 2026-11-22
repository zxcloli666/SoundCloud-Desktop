import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Globe, Users } from '../../lib/icons';
import { Avatar } from '../ui/Avatar';
import type { RelatedArtist } from './types';

interface ArtistRelatedTabProps {
  related: RelatedArtist[];
}

function ArtistRelatedTabImpl({ related }: ArtistRelatedTabProps) {
  const { t } = useTranslation();
  if (related.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink/[0.03] ring-1 ring-ink/[0.07]">
          <Users size={24} className="text-ink-15" />
        </div>
        <p className="text-ink-30 text-sm">{t('artist.noRelated')}</p>
      </div>
    );
  }

  const max = Math.max(...related.map((r) => r.weight), 1);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
      {related.map((a) => (
        <RelatedCard key={a.id} item={a} maxWeight={max} />
      ))}
    </div>
  );
}

const RelatedCard = memo(({ item, maxWeight }: { item: RelatedArtist; maxWeight: number }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const pct = Math.max(0.08, Math.min(1, item.weight / maxWeight));
  return (
    <button
      type="button"
      onClick={() => navigate(`/artist/${encodeURIComponent(item.id)}`)}
      className="group flex cursor-pointer flex-col items-center gap-3 rounded-3xl border border-ink/[0.07] p-5 transition-colors duration-200 hover:bg-ink/[0.05]"
    >
      <div className="h-20 w-20 overflow-hidden rounded-full ring-1 ring-ink/10">
        <Avatar src={item.avatar_url} alt={item.name} size={80} />
      </div>
      <div className="w-full min-w-0 text-center">
        <p className="truncate text-[13px] font-semibold text-ink-90">{item.name}</p>
        {item.country && (
          <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-ink-35">
            <Globe size={9} /> {item.country}
          </p>
        )}
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-ink/[0.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-30">
        {t('artist.affinity')} {(pct * 100).toFixed(0)}%
      </span>
    </button>
  );
});

export const ArtistRelatedTab = memo(ArtistRelatedTabImpl);
