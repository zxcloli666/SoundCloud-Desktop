import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { chatBridge } from '../../../../lib/chat/bridge';
import type { UploadView } from '../../../../lib/chat/media-types';
import { Plus, X } from '../../../../lib/icons';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { FailureAction } from './FailureAction';
import { failureOf } from './failure';
import { isDone } from './progress';
import { PreparingTile, StagedTile, TILE } from './StagedTile';
import type { StagedAlbum as Album } from './useStagedAlbum';

export const StagedAlbum = memo(function StagedAlbum({
  album,
  max,
  onAdd,
  onFail,
}: {
  album: Album;
  max: number;
  onAdd: () => void;
  onFail: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const firstFailed = album.uploads.find((upload) => upload.state === 'failed');
  const error = useChatMediaStore((state) =>
    firstFailed ? state.errors[firstFailed.id] : undefined,
  );
  const count = album.uploads.length;
  const shown = count + album.preparing;
  if (shown === 0) return null;
  const full = shown >= max;
  const ready = album.uploads.filter(isDone).length;
  const failed = album.uploads.filter((upload) => upload.state === 'failed').length;
  const failure = firstFailed ? failureOf(error, t) : null;

  const busy = album.preparing > 0;
  const remove = (upload: UploadView) => {
    if (busy) return;
    const job =
      count === 1
        ? chatBridge.mediaAlbumCancel(upload.album)
        : useChatMediaStore.getState().cancelUpload(upload.id);
    void job.then(() => useChatMediaStore.getState().refreshUploads()).catch(onFail);
  };
  const removeAll = () => {
    if (!album.id || busy) return;
    void chatBridge
      .mediaAlbumCancel(album.id)
      .then(() => useChatMediaStore.getState().refreshUploads())
      .catch(onFail);
  };

  return (
    <div
      data-ui="chat-staged-album"
      className="mx-1 mb-1.5 rounded-[18px] border border-ink/[0.07] bg-ink/[0.03] px-2.5 pt-2 pb-2 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
    >
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[10.5px] font-semibold tabular-nums"
          style={{
            background: full ? 'var(--color-accent-glow)' : 'rgb(var(--ink) / 0.07)',
            color: full ? 'var(--color-accent-hover)' : 'rgb(var(--ink) / 0.6)',
          }}
        >
          {t('chat.media.compose.count', { count: shown, max })}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-ink-45">
          {failed > 0
            ? t('chat.media.rows.failedCount', { count: failed })
            : album.preparing > 0
              ? t('chat.media.compose.preparing')
              : ready === count
                ? full
                  ? t('chat.media.compose.full')
                  : t('chat.media.compose.ready')
                : t('chat.media.compose.uploading')}
        </span>
        <button
          type="button"
          onClick={removeAll}
          disabled={!album.id || busy}
          className="flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] text-ink-45 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-ink-80 disabled:cursor-default disabled:opacity-40"
        >
          <X size={11} />
          {t('chat.media.compose.removeAll')}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 px-0.5 pt-0.5">
        {album.uploads.map((upload) => (
          <StagedTile
            key={upload.id}
            upload={upload}
            locked={busy}
            onRemove={remove}
            onFail={onFail}
          />
        ))}
        {Array.from({ length: album.preparing }, (_, index) => (
          <PreparingTile key={`preparing-${index}`} />
        ))}
        {!full && (
          <button
            type="button"
            onClick={onAdd}
            aria-label={t('chat.media.compose.add')}
            className="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[14px] border border-dashed border-ink/[0.16] text-ink-40 transition-colors duration-150 hover:border-ink/30 hover:bg-ink/[0.04] hover:text-ink-80 focus-visible:border-ink/40"
            style={{ width: TILE, height: TILE }}
          >
            <Plus size={17} />
            <span className="text-[10px] font-medium">{t('chat.media.compose.add')}</span>
          </button>
        )}
      </div>
      {failure && firstFailed && (
        <div className="mt-2 flex items-center gap-2 px-0.5 text-[11.5px]">
          <span className="min-w-0 flex-1 truncate text-bad">{failure.text}</span>
          <FailureAction failure={failure} upload={firstFailed} />
        </div>
      )}
    </div>
  );
});
