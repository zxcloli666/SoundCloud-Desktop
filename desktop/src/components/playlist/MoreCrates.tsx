import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUserPlaylists } from '../../lib/hooks';
import { ListMusic } from '../../lib/icons';
import { PlaylistCard } from '../music/PlaylistCard';
import { HorizontalScroll } from '../ui/HorizontalScroll';

export const MoreCrates = React.memo(function MoreCrates({
  curatorUrn,
  curatorName,
  excludeUrn,
}: {
  curatorUrn: string;
  curatorName: string;
  excludeUrn: string;
}) {
  const { t } = useTranslation();
  const { playlists } = useUserPlaylists(curatorUrn);
  const others = (playlists ?? []).filter((p) => p.urn !== excludeUrn).slice(0, 12);

  if (others.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5 px-1">
        <ListMusic size={16} className="text-ink-55" />
        <h2 className="text-[16px] font-bold tracking-tight text-ink-90">
          {t('playlist.moreCrates', { name: curatorName })}
        </h2>
        <span className="text-[12px] tabular-nums text-ink-30">{others.length}</span>
      </div>
      <HorizontalScroll className="-mx-1 px-1">
        <div className="flex gap-4">
          {others.map((p) => (
            <div key={p.urn} className="w-[176px] shrink-0">
              <PlaylistCard playlist={p} showPlayback />
            </div>
          ))}
        </div>
      </HorizontalScroll>
    </section>
  );
});
