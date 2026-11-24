import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type Playlist, useAddToPlaylist, useRemoveFromPlaylist } from '../../../lib/hooks';
import { Check, ListMusic, Loader2, Lock, Plus } from '../../../lib/icons';
import { playlistCoverUrl } from '../../../lib/playlist-cover';
import { useSettingsStore } from '../../../stores/settings';

export const PlaylistRow = memo(function PlaylistRow({
  playlist,
  trackUrn,
  inside,
  ready,
  onMark,
}: {
  playlist: Playlist;
  trackUrn: string;
  inside: boolean;
  ready: boolean;
  onMark: (playlistUrn: string, inside: boolean) => void;
}) {
  const { t } = useTranslation();
  const place = useSettingsStore((s) => s.playlistPlace);
  const add = useAddToPlaylist(playlist.urn);
  const remove = useRemoveFromPlaylist(playlist.urn);
  const busy = add.isPending || remove.isPending;
  const cover = playlistCoverUrl(playlist.artwork_url, playlist.tracks, 't200x200');

  const toggle = () => {
    const edit = inside ? remove.mutateAsync(trackUrn) : add.mutateAsync({ trackUrn, place });
    edit.then(() => onMark(playlist.urn, !inside)).catch(() => {});
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={inside}
      disabled={busy || !ready}
      onClick={toggle}
      title={inside ? t('playlist.removeTrack') : t('playlist.addToPlaylist')}
      data-ui="playlist-picker-row"
      data-state={busy ? 'busy' : inside ? 'inside' : 'outside'}
      className={`group flex h-full w-full cursor-pointer items-center gap-3.5 rounded-2xl px-2.5 text-left transition-colors duration-150 disabled:cursor-default ${
        inside ? 'bg-accent/[0.1] hover:bg-accent/[0.15]' : 'hover:bg-ink/[0.06]'
      }`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-ink/[0.05] ring-1 ring-ink/[0.07]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" decoding="async" />
        ) : (
          <ListMusic size={17} className="text-ink-25" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-ink-92">
          {playlist.title}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] tabular-nums text-ink-45">
          {playlist.sharing === 'private' && <Lock size={11} className="shrink-0" />}
          {t('playlist.tracks', { count: playlist.track_count })}
        </span>
      </span>
      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-150 ${
          inside
            ? 'bg-accent text-accent-contrast'
            : 'bg-ink/[0.06] text-ink-45 group-hover:bg-ink/[0.12] group-hover:text-ink-90'
        }`}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : inside ? (
          <Check size={15} strokeWidth={3} />
        ) : (
          <Plus size={15} />
        )}
      </span>
    </button>
  );
});
