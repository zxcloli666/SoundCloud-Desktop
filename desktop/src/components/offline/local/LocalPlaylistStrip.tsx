import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from '../../../lib/icons';
import type { LocalPlaylist } from '../../../lib/local-library';
import { useLocalLibrary } from '../../../stores/local-library';
import { LocalPlaylistCover } from './LocalPlaylistCover';
import { PlaylistNameInput } from './PlaylistNameInput';

const TILE =
  'group flex w-[148px] flex-none cursor-pointer flex-col gap-2.5 rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-2.5 text-left transition-all duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:border-white/[0.13] hover:bg-white/[0.04]';

const NewPlaylistTile = React.memo(function NewPlaylistTile({
  onCreated,
}: {
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className={`${TILE} cursor-default justify-center`}>
        <PlaylistNameInput
          initial=""
          onCancel={() => setEditing(false)}
          onSubmit={(title) => {
            setEditing(false);
            onCreated(useLocalLibrary.getState().createPlaylist(title, []));
          }}
        />
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className={TILE}>
      <div
        className="flex aspect-square w-full items-center justify-center rounded-[11px] border border-dashed text-white/45 transition-colors group-hover:text-white/80"
        style={{ borderColor: 'var(--color-accent-glow)' }}
      >
        <Plus size={26} strokeWidth={1.8} />
      </div>
      <div className="truncate px-0.5 text-[12.5px] font-semibold text-white/70 group-hover:text-white/90">
        {t('local.newPlaylist')}
      </div>
    </button>
  );
});

const PlaylistTile = React.memo(function PlaylistTile({
  playlist,
  onOpen,
}: {
  playlist: LocalPlaylist;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={() => onOpen(playlist.id)} className={TILE}>
      <LocalPlaylistCover playlist={playlist} className="aspect-square w-full rounded-[11px]" />
      <div className="min-w-0 px-0.5">
        <div className="truncate text-[12.5px] font-semibold text-white/88 group-hover:text-white">
          {playlist.title}
        </div>
        <div className="font-mono text-[10.5px] tabular-nums text-white/35">
          {t('local.tracksCount', { count: playlist.trackIds.length })}
        </div>
      </div>
    </button>
  );
});

export const LocalPlaylistStrip = React.memo(function LocalPlaylistStrip({
  playlists,
  onOpen,
}: {
  playlists: LocalPlaylist[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
        {t('local.playlistsTitle')}
      </div>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        <NewPlaylistTile onCreated={onOpen} />
        {playlists.map((playlist) => (
          <PlaylistTile key={playlist.id} playlist={playlist} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
});
