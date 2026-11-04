import { memo, type ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { MessageAttachment } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { AlbumFrame, type TileStyle } from './AlbumFrame';
import { albumLayout } from './album-layout';
import { MediaFace, useThumb } from './MediaFace';

const AlbumTile = memo(function AlbumTile({
  conversationId,
  attachment,
  index,
  total,
  compact,
  style,
  onOpen,
}: {
  conversationId: ConvId;
  attachment: MessageAttachment;
  index: number;
  total: number;
  compact: boolean;
  style: TileStyle;
  onOpen: (index: number) => void;
}) {
  const { t } = useTranslation();
  const thumb = useThumb(attachment.mediaId);
  const label = thumb.gone
    ? t(`chat.gallery.tile.${thumb.gone}`)
    : thumb.phase === 'failed'
      ? t('chat.gallery.tile.failed')
      : t('chat.gallery.tile.open', { n: index + 1, total });
  return (
    <button
      type="button"
      data-ui="chat-album-tile"
      data-state={thumb.gone ?? thumb.phase}
      aria-label={label}
      title={thumb.gone || thumb.phase === 'failed' ? label : undefined}
      disabled={thumb.gone !== null}
      onClick={() => (thumb.phase === 'failed' ? thumb.retry() : onOpen(index))}
      className="group absolute cursor-pointer overflow-hidden outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-inset disabled:cursor-default"
      style={style}
    >
      <MediaFace
        conversationId={conversationId}
        mediaId={attachment.mediaId}
        thumb={thumb}
        compact={compact}
      />
      {thumb.phase === 'ready' && !thumb.gone && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-150 group-hover:bg-ink/[0.06]"
        />
      )}
    </button>
  );
});

export const SentAlbum = memo(function SentAlbum({
  conversationId,
  attachments,
  overlay,
  onOpen,
}: {
  conversationId: ConvId;
  attachments: MessageAttachment[];
  overlay?: ReactNode;
  onOpen: (index: number) => void;
}) {
  const box = useMemo(() => albumLayout(attachments), [attachments]);
  const compact = attachments.length > 4;
  return (
    <AlbumFrame box={box} overlay={overlay}>
      {(index, style) => (
        <AlbumTile
          key={`${attachments[index].mediaId}:${index}`}
          conversationId={conversationId}
          attachment={attachments[index]}
          index={index}
          total={attachments.length}
          compact={compact}
          style={style}
          onOpen={onOpen}
        />
      )}
    </AlbumFrame>
  );
});
