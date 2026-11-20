import React, { type RefObject, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type CoverFrame, coverTooSmall, fullFrame } from '../../../lib/cover-crop';
import type { Playlist } from '../../../lib/hooks';
import { ImagePlus } from '../../../lib/icons';
import { COVER_TYPES, loadCover, renderCover } from '../../../lib/playlist-artwork';
import type { Track } from '../../../stores/player';
import { usePlaylistCoverStore } from '../../../stores/playlist-cover';
import { CrateStack } from '../CrateStack';
import { CoverBadge } from './CoverBadge';
import { CoverDialog, type CoverDraft } from './CoverDialog';
import { useCoverSync } from './useCoverSync';

export const PlaylistCover = React.memo(function PlaylistCover({
  playlist,
  tracks,
  isPlaying,
  trackCount,
  onPlay,
  isOwner,
  inputRef,
}: {
  playlist: Playlist;
  tracks: Track[];
  isPlaying: boolean;
  trackCount: number;
  onPlay: () => void;
  isOwner: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const { t } = useTranslation();
  const playlistUrn = playlist.urn;
  const artworkUrl = playlist.artwork_url ?? null;
  const change = useCoverSync(playlistUrn, artworkUrl);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CoverDraft>({ kind: 'loading' });
  const pick = useCallback(() => inputRef.current?.click(), [inputRef]);
  const sourceUrl = draft.kind === 'ready' ? draft.source.url : null;

  useEffect(() => {
    if (sourceUrl) return () => URL.revokeObjectURL(sourceUrl);
  }, [sourceUrl]);

  const take = async (file: File) => {
    setOpen(true);
    setDraft({ kind: 'loading' });
    try {
      const source = await loadCover(file);
      if (coverTooSmall(source.size)) {
        URL.revokeObjectURL(source.url);
        setDraft({ kind: 'problem', error: 'playlist.cover.tooSmall' });
        return;
      }
      setDraft({ kind: 'ready', source, frame: fullFrame(source.size) });
    } catch {
      setDraft({ kind: 'problem', error: 'playlist.cover.unreadable' });
    }
  };

  const setFrame = (frame: CoverFrame) =>
    setDraft((now) => (now.kind === 'ready' ? { ...now, frame } : now));

  const save = async () => {
    if (draft.kind !== 'ready') return;
    try {
      const jpeg = await renderCover(draft.source.image, draft.frame);
      setOpen(false);
      void usePlaylistCoverStore.getState().send(playlistUrn, jpeg, artworkUrl);
    } catch {
      setDraft({ kind: 'problem', error: 'playlist.cover.unreadable' });
    }
  };

  const local = change && change.phase !== 'failed' ? change.preview : null;
  const busy = change?.phase === 'sending';

  return (
    <div className="group/cover relative shrink-0 self-center @min-[740px]:self-start">
      <CrateStack
        playlist={playlist}
        tracks={tracks}
        isPlaying={isPlaying}
        trackCount={trackCount}
        onPlay={onPlay}
        cover={local}
      />
      {change && (
        <div className="absolute -top-2 -left-1 z-[60]" data-scheme="dark">
          <CoverBadge
            change={change}
            onRetry={() => usePlaylistCoverStore.getState().retry(playlistUrn)}
            onPick={pick}
            onDrop={() => usePlaylistCoverStore.getState().drop(playlistUrn)}
          />
        </div>
      )}
      {isOwner && (
        <>
          <button
            type="button"
            data-ui="playlist-cover-change"
            onClick={pick}
            disabled={busy}
            title={t('playlist.cover.change')}
            aria-label={t('playlist.cover.change')}
            data-scheme="dark"
            className="absolute top-2.5 right-2.5 z-[60] inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-90 opacity-0 scale-90 transition-all duration-200 ease-[var(--ease-apple)] group-hover/cover:opacity-100 group-hover/cover:scale-100 focus-visible:opacity-100 focus-visible:scale-100 pointer-coarse:opacity-100 pointer-coarse:scale-100 hover:text-ink active:scale-95 disabled:hidden cursor-pointer motion-reduce:transition-none"
            style={{
              background: 'rgb(var(--paper) / 0.72)',
              border: '0.5px solid rgb(var(--ink) / 0.18)',
              boxShadow: '0 8px 20px rgb(var(--shade) / calc(0.45 * var(--shade-alpha)))',
            }}
          >
            <ImagePlus size={16} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={COVER_TYPES}
            className="hidden"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void take(file);
            }}
          />
          <CoverDialog
            open={open}
            draft={draft}
            onOpenChange={setOpen}
            onPick={pick}
            onFrame={setFrame}
            onSave={save}
          />
        </>
      )}
    </div>
  );
});
