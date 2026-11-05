import { memo, type ReactNode, type SyntheticEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadView } from '../../../../lib/chat/media-types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { failureOf, notifyFailure } from '../compose/failure';
import { AlbumFrame, type TileStyle } from './AlbumFrame';
import { albumLayout, type Size } from './album-layout';
import { CircleAlert, RotateCcw, X } from './icons';
import { useCalmMotion } from './motion';
import { ProgressRing } from './ProgressRing';
import { uploadDone, uploadFraction } from './upload-progress';
import { viewUrl } from './urls';

const SQUARE: Size = { w: 1, h: 1 };

const NO_UPLOADS: UploadView[] = [];

export function useAlbumUploads(album: string, pending: boolean): UploadView[] {
  const uploads = useChatMediaStore((state) => (pending ? state.uploads : NO_UPLOADS));
  return useMemo(
    () =>
      pending
        ? uploads.filter((upload) => upload.album === album).sort((a, b) => a.position - b.position)
        : [],
    [uploads, album, pending],
  );
}

function RoundAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-paper/70 text-ink-90 ring-1 ring-ink/15 transition-colors duration-150 hover:bg-paper/90 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)]"
    >
      {children}
    </button>
  );
}

const UploadTile = memo(function UploadTile({
  upload,
  style,
  onSize,
}: {
  upload: UploadView;
  style: TileStyle;
  onSize: (id: string, size: Size) => void;
}) {
  const { t } = useTranslation();
  const calm = useCalmMotion();
  const error = useChatMediaStore((state) => state.errors[upload.id]);
  const done = uploadDone(upload);
  const failed = upload.state === 'failed';
  const waiting = upload.state === 'queued' || upload.state === 'reserved';
  const failure = failed ? failureOf(error, t) : null;
  const reason = failure?.text ?? '';
  const act = (call: (id: string) => Promise<void>) =>
    void call(upload.id).catch((problem) => notifyFailure(problem, t));
  const media = useChatMediaStore.getState;
  const onLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.naturalWidth > 0)
      onSize(upload.id, { w: image.naturalWidth, h: image.naturalHeight });
  };

  return (
    <div
      data-ui="chat-upload-tile"
      data-state={upload.state}
      className="absolute overflow-hidden"
      style={style}
    >
      <span aria-hidden className="absolute inset-0 bg-ink/[0.06]" />
      <img
        src={viewUrl(upload.conversationId, upload.id, 'upload-thumb')}
        alt=""
        draggable={false}
        onLoad={onLoad}
        className="absolute inset-0 size-full object-cover"
      />
      <span
        data-scheme="dark"
        className="chat-media-motion absolute inset-0 flex items-center justify-center"
        style={{
          background: failed
            ? 'color-mix(in srgb, var(--color-rose-500) 22%, rgb(var(--paper) / 0.5))'
            : 'rgb(var(--paper) / 0.32)',
          opacity: done ? 0 : 1,
          transition: calm ? undefined : 'opacity 360ms ease-out',
        }}
      >
        {failed ? (
          <span className="flex items-center gap-2">
            {failure?.action !== 'none' && (
              <RoundAction
                label={t('chat.gallery.upload.retryReason', { reason })}
                onClick={() => act(media().retryUpload)}
              >
                <RotateCcw size={15} />
              </RoundAction>
            )}
            <RoundAction
              label={t('chat.gallery.upload.cancel')}
              onClick={() => act(media().cancelUpload)}
            >
              <X size={15} />
            </RoundAction>
          </span>
        ) : (
          !done && <ProgressRing fraction={uploadFraction(upload)} waiting={waiting} />
        )}
      </span>
      {failed && (
        <span
          aria-hidden
          data-scheme="dark"
          title={reason}
          className="absolute top-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-paper/70 text-bad"
        >
          <CircleAlert size={12} />
        </span>
      )}
    </div>
  );
});

export const PendingAlbum = memo(function PendingAlbum({
  uploads,
  overlay,
}: {
  uploads: UploadView[];
  overlay?: ReactNode;
}) {
  const [sizes, setSizes] = useState<Record<string, Size>>({});
  const onSize = useCallback(
    (id: string, size: Size) =>
      setSizes((current) =>
        current[id]?.w === size.w && current[id]?.h === size.h
          ? current
          : { ...current, [id]: size },
      ),
    [],
  );
  const box = useMemo(
    () => albumLayout(uploads.map((upload) => sizes[upload.id] ?? SQUARE)),
    [uploads, sizes],
  );
  return (
    <AlbumFrame box={box} overlay={overlay}>
      {(index, style) => (
        <UploadTile key={uploads[index].id} upload={uploads[index]} style={style} onSize={onSize} />
      )}
    </AlbumFrame>
  );
});
