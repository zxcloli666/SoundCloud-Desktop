import { memo, type ReactNode, useEffect, useMemo } from 'react';
import type { MessageAttachment } from '../../../../lib/chat/media-types';
import type { ConvId } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { AlbumFrame } from './AlbumFrame';
import { albumLayout } from './album-layout';
import { Shimmer } from './MediaFace';
import { useCalmMotion } from './motion';
import { ProgressRing } from './ProgressRing';
import { viewUrl } from './urls';

function hide(event: { currentTarget: HTMLImageElement }) {
  event.currentTarget.style.visibility = 'hidden';
}

export const LocalAlbum = memo(function LocalAlbum({
  conversationId,
  attachments,
  parked,
  overlay,
}: {
  conversationId: ConvId;
  attachments: MessageAttachment[];
  parked: boolean;
  overlay?: ReactNode;
}) {
  const calm = useCalmMotion();
  const box = useMemo(() => albumLayout(attachments), [attachments]);

  useEffect(() => {
    if (parked)
      void useChatMediaStore
        .getState()
        .refreshUploads()
        .catch(() => undefined);
  }, [parked]);

  return (
    <AlbumFrame box={box} overlay={overlay}>
      {(index, style) => (
        <div
          key={`${attachments[index].mediaId}:${index}`}
          data-ui="chat-upload-tile"
          data-state="queued"
          className="absolute overflow-hidden"
          style={style}
        >
          <span aria-hidden className="absolute inset-0 bg-ink/[0.06]" />
          {parked && (
            <img
              src={viewUrl(conversationId, attachments[index].mediaId, 'upload-thumb')}
              alt=""
              draggable={false}
              onError={hide}
              className="absolute inset-0 size-full object-cover"
            />
          )}
          {!parked && !calm && <Shimmer />}
          {parked && (
            <span
              data-scheme="dark"
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgb(var(--paper) / 0.32)' }}
            >
              <ProgressRing fraction={0} waiting />
            </span>
          )}
        </div>
      )}
    </AlbumFrame>
  );
});
