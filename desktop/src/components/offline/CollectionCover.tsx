import React from 'react';
import { art } from '../../lib/formatters';
import { Disc3, ListMusic } from '../../lib/icons';
import type { CollectionView } from './types';

export const CollectionCover = React.memo(function CollectionCover({
  view,
  className,
}: {
  view: CollectionView;
  className: string;
}) {
  const src = art(view.artworkUrl);
  const Icon = view.kind === 'album' ? Disc3 : ListMusic;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(135deg, var(--color-accent-glow), rgba(255,255,255,0.03) 70%)',
      }}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-white/45">
          <Icon size={28} />
        </div>
      )}
    </div>
  );
});
