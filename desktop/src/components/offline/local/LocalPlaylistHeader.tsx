import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Pencil, Trash2 } from '../../../lib/icons';
import type { LocalPlaylist } from '../../../lib/local-library';
import { useLocalLibrary } from '../../../stores/local-library';
import { LocalPlaylistCover } from './LocalPlaylistCover';
import { PlaylistNameInput } from './PlaylistNameInput';

const CONFIRM_RESET_MS = 4000;

export const LocalPlaylistHeader = React.memo(function LocalPlaylistHeader({
  playlist,
  onBack,
}: {
  playlist: LocalPlaylist;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), CONFIRM_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  const remove = () => {
    onBack();
    useLocalLibrary.getState().deletePlaylist(playlist.id);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-3 pr-4">
      <button
        type="button"
        onClick={onBack}
        aria-label={t('search.back')}
        className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/[0.07] hover:text-white"
      >
        <ChevronLeft size={18} />
      </button>
      <LocalPlaylistCover playlist={playlist} className="size-16 flex-none rounded-[12px]" />
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.2em] text-white/35">
          {t('local.playlistKind')}
        </div>
        {renaming ? (
          <PlaylistNameInput
            initial={playlist.title}
            className="max-w-[320px] py-0.5"
            onCancel={() => setRenaming(false)}
            onSubmit={(title) => {
              setRenaming(false);
              useLocalLibrary.getState().renamePlaylist(playlist.id, title);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="group/title flex max-w-full cursor-pointer items-center gap-2 text-left"
          >
            <span className="truncate text-[18px] font-semibold tracking-[-0.02em] text-white/92">
              {playlist.title}
            </span>
            <Pencil
              size={13}
              className="flex-none text-white/30 opacity-0 transition-opacity group-hover/title:opacity-100"
            />
          </button>
        )}
        <div className="truncate text-[12px] text-white/45">
          {t('local.tracksCount', { count: playlist.trackIds.length })} · {t('local.onThisDevice')}
        </div>
      </div>
      <button
        type="button"
        onClick={() => (confirming ? remove() : setConfirming(true))}
        className={`flex h-9 cursor-pointer items-center gap-2 rounded-[11px] border px-3.5 text-[12.5px] font-semibold transition-colors ${
          confirming
            ? 'border-red-500/30 bg-red-500/15 text-red-300'
            : 'border-white/[0.08] bg-white/[0.03] text-white/55 hover:border-red-500/25 hover:text-red-300'
        }`}
      >
        <Trash2 size={13} />
        {confirming ? t('local.deletePlaylistConfirm') : t('local.deletePlaylist')}
      </button>
    </div>
  );
});
