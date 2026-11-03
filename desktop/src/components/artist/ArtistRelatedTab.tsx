import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { type Aura, auraRgb, auraRgba } from '../../lib/aura';
import { Globe, Users } from '../../lib/icons';
import {usePerfMode} from '../../lib/perf';
import { Avatar } from '../ui/Avatar';
import type { RelatedArtist } from './types';

interface ArtistRelatedTabProps {
  related: RelatedArtist[];
  aura: Aura;
}

function ArtistRelatedTabImpl({ related, aura }: ArtistRelatedTabProps) {
  const { t } = useTranslation();
  if (related.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{
            background: 'rgb(var(--ink) / 0.03)',
            border: '0.5px solid rgb(var(--ink) / 0.06)',
          }}
        >
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
        <RelatedCard key={a.id} item={a} aura={aura} maxWeight={max} />
      ))}
    </div>
  );
}

const RelatedCard = memo(
  ({ item, aura, maxWeight }: { item: RelatedArtist; aura: Aura; maxWeight: number }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
      const perf = usePerfMode();
    const pct = Math.max(0.08, Math.min(1, item.weight / maxWeight));
      const cb = perf.blur(20);
    return (
      <button
        type="button"
        onClick={() => navigate(`/artist/${encodeURIComponent(item.id)}`)}
        className="group relative flex flex-col items-center gap-3 p-5 rounded-3xl cursor-pointer transition-all duration-500 overflow-hidden hover:scale-[1.03]"
        style={{
            background: cb > 0 ? 'rgb(var(--ink) / 0.03)' : 'rgb(var(--surface-hi) / 0.85)',
          border: '0.5px solid rgb(var(--ink) / 0.06)',
            backdropFilter: cb > 0 ? `blur(${cb}px)` : undefined,
            WebkitBackdropFilter: cb > 0 ? `blur(${cb}px)` : undefined,
        }}
      >
          {perf.bloom && (
              <div
                  className="absolute -inset-x-12 -top-20 h-44 pointer-events-none opacity-50 group-hover:opacity-90 transition-opacity duration-700"
                  style={{
                      background: `radial-gradient(60% 60% at 50% 50%, ${auraRgba(aura, 0.4)}, transparent 70%)`,
                      filter: 'blur(40px)',
                  }}
              />
          )}
        <div
          className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-ink/10 group-hover:ring-ink/30 transition-all duration-500"
          style={{ boxShadow: `0 12px 30px ${auraRgba(aura, 0.25)}` }}
        >
          <Avatar src={item.avatar_url} alt={item.name} size={80} />
        </div>
        <div className="text-center min-w-0 w-full relative">
          <p className="text-[13px] font-semibold text-ink-90 truncate">{item.name}</p>
          {item.country && (
            <p className="inline-flex items-center gap-1 text-[10px] text-ink-35 mt-0.5">
              <Globe size={9} /> {item.country}
            </p>
          )}
        </div>
        <div className="relative w-full h-1 rounded-full overflow-hidden bg-ink/[0.04]">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: `${pct * 100}%`,
              background: `linear-gradient(90deg, ${auraRgb(aura)}, ${auraRgba(aura, 0.3)})`,
              boxShadow: `0 0 10px ${auraRgba(aura, 0.5)}`,
            }}
          />
        </div>
        <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-ink-30">
          {t('artist.affinity')} {(pct * 100).toFixed(0)}%
        </span>
      </button>
    );
  },
);

export const ArtistRelatedTab = memo(ArtistRelatedTabImpl);
