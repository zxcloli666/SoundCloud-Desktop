import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { dateFormatted, durLong } from '../../lib/formatters';
import type { Playlist } from '../../lib/hooks';
import { Calendar, Clock, Library, Loader2, RefreshCw } from '../../lib/icons';
import type { PlaylistDelivery } from '../../lib/playlist-delivery';
import { releaseKindOf } from '../../lib/playlist-kind';
import type { ArrangeMode } from '../../lib/track-order';
import type { Track } from '../../stores/player';
import type { GenreShare } from '../search/utils';
import { GlassHeroPanel } from '../ui/GlassHeroPanel';
import { CuratorCard } from './CuratorCard';
import { PlaylistCover } from './cover/PlaylistCover';
import { PlaylistActions } from './PlaylistActions';

const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-ink/[0.07] bg-ink/[0.05] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-55';

function Meta({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={CHIP}>
      {icon && <span className="text-ink-45">{icon}</span>}
      {children}
    </span>
  );
}

function kindLabelKey(kind: string | undefined): { ns: string; defaultValue: string } {
  switch (kind) {
    case 'compilation':
      return { ns: 'playlist.kind.collection', defaultValue: 'Collection' };
    case 'album':
    case 'ep':
    case 'single':
      return { ns: `artist.kind.${kind}`, defaultValue: kind };
    default:
      return { ns: 'playlist.kind.set', defaultValue: 'Set' };
  }
}

export const PlaylistHero = React.memo(function PlaylistHero({
  playlist,
  tracks,
  genres,
  isOwner,
  isPlaying,
  isPinned,
  trackCount,
  onPlayAll,
  onShuffle,
  onTogglePin,
  onEdit,
  onDelete,
  canArrange,
  delivery,
  onArrange,
  onRemoveDuplicates,
}: {
  playlist: Playlist;
  tracks: Track[];
  genres: GenreShare[];
  isOwner: boolean;
  isPlaying: boolean;
  isPinned: boolean;
  trackCount: number;
  onPlayAll: () => void;
  onShuffle: () => void;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canArrange: boolean;
  delivery: PlaylistDelivery | null;
  onArrange: (mode: ArrangeMode) => void;
  onRemoveDuplicates: (indices: Set<number>) => void;
}) {
  const { t } = useTranslation();
  const coverInput = useRef<HTMLInputElement>(null);
  const changeCover = useCallback(() => coverInput.current?.click(), []);
  const kl = kindLabelKey(releaseKindOf(playlist) ?? playlist.kind);
  return (
    <GlassHeroPanel className="@container">
      <div
        data-ui="playlist-hero"
        className="p-6 @min-[512px]:p-10 flex flex-col @min-[740px]:flex-row gap-8 @min-[740px]:gap-12 items-center @min-[740px]:items-start"
      >
        <PlaylistCover
          playlist={playlist}
          tracks={tracks}
          isPlaying={isPlaying}
          trackCount={trackCount}
          onPlay={onPlayAll}
          isOwner={isOwner}
          inputRef={coverInput}
        />

        <div className="flex-1 min-w-0 w-full flex flex-col gap-5 text-center @min-[740px]:text-left">
          <div className="flex flex-wrap items-center gap-2 justify-center @min-[740px]:justify-start">
            <span className={`${CHIP} text-ink-70`}>
              <Library size={11} /> {t(kl.ns, { defaultValue: kl.defaultValue })}
            </span>
            {genres.length > 1 && (
              <span className={CHIP}>{t('playlist.spansGenres', { count: genres.length })}</span>
            )}
          </div>

          <h1 className="text-4xl @min-[512px]:text-6xl @min-[960px]:text-7xl font-black leading-[0.9] tracking-tighter break-words text-ink">
            {playlist.title}
          </h1>

          {genres.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 justify-center @min-[740px]:justify-start">
              {genres.map((g) => (
                <span
                  key={g.genre}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-45"
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                  {g.genre}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 justify-center @min-[740px]:justify-start">
            {playlist.duration > 0 && (
              <Meta icon={<Clock size={11} />}>{durLong(playlist.duration)}</Meta>
            )}
            {playlist.last_modified && (
              <Meta icon={<Calendar size={11} />}>
                {t('playlist.lastEdited', { date: dateFormatted(playlist.last_modified) })}
              </Meta>
            )}
            {playlist.label_name && <Meta>{playlist.label_name}</Meta>}
            {delivery === 'sending' && (
              <Meta icon={<Loader2 size={11} className="animate-spin" />}>
                {t('playlist.sendingToSoundCloud')}
              </Meta>
            )}
            {delivery === 'blocked' && (
              <Meta icon={<RefreshCw size={11} />}>{t('playlist.notSentToSoundCloud')}</Meta>
            )}
          </div>

          <div className="pt-1">
            <PlaylistActions
              playlist={playlist}
              isOwner={isOwner}
              isPlaying={isPlaying}
              isPinned={isPinned}
              tracks={tracks}
              trackCount={trackCount}
              onPlayAll={onPlayAll}
              onShuffle={onShuffle}
              onTogglePin={onTogglePin}
              onEdit={onEdit}
              onChangeCover={changeCover}
              onDelete={onDelete}
              canArrange={canArrange}
              onArrange={onArrange}
              onRemoveDuplicates={onRemoveDuplicates}
            />
          </div>

          <CuratorCard user={playlist.user} isOwner={isOwner} note={playlist.description} />
        </div>
      </div>
    </GlassHeroPanel>
  );
});
