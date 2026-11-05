import { memo, useCallback } from 'react';
import type { Tick } from '../../../lib/chat/render';
import type { Message } from '../../../lib/chat/types';
import { useChatMediaStore } from '../../../stores/chat/media';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { BubbleMeta } from '../bubbles/BubbleMeta';
import { useThread } from '../thread/context';
import { imagesOf, threadImages } from './view/images';
import { LocalAlbum } from './view/LocalAlbum';
import { showLightbox } from './view/lightbox-root';
import { useMediaView } from './view/media-state';
import { PendingAlbum, useAlbumUploads } from './view/PendingAlbum';
import { SentAlbum } from './view/SentAlbum';
import { UploadStatus, uploadStatusShown } from './view/UploadStatus';

export function useHasMedia(message: Message): boolean {
  const pending = message.seq === null;
  const uploading = useChatMediaStore(
    (state) => pending && state.uploads.some((upload) => upload.album === message.clientId),
  );
  return message.body.type === 'text' && (message.attachments.length > 0 || uploading);
}

function MetaPill({ message, tick }: { message: Message; tick: Tick | null }) {
  return (
    <span
      data-scheme="dark"
      className="pointer-events-none absolute right-1.5 bottom-1.5 z-10 rounded-full bg-paper/70 px-1.5 py-[3px] [&>span]:pointer-events-none! [&>span]:text-ink-85!"
    >
      <BubbleMeta message={message} tick={tick} floating={false} />
    </span>
  );
}

export const MediaBubble = memo(function MediaBubble({
  message,
  tick = null,
  solo = false,
}: {
  message: Message;
  tick?: Tick | null;
  solo?: boolean;
}) {
  useMediaView();
  const { nameOf, jumpTo } = useThread();
  const uploads = useAlbumUploads(message.clientId, message.seq === null);
  const unsent = message.seq === null && message.attachments.length > 0;
  const parked = useChatMediaStore((state) => unsent && state.parked[message.clientId] === true);
  const unknown = useChatMediaStore((state) => unsent && !state.parkedReady);
  const overlay = solo ? <MetaPill message={message} tick={tick} /> : undefined;

  const open = useCallback(
    (index: number, opener: HTMLElement) => {
      const own = imagesOf(message);
      const start = own[index];
      if (!start) return;
      const thread = useChatThreadStore.getState().threads[message.conversationId];
      const loaded = threadImages(thread?.messages ?? []);
      const inThread =
        message.seq !== null && loaded.some((item) => item.clientId === message.clientId);
      showLightbox({
        items: inThread ? loaded : own,
        start,
        more: inThread && (thread?.moreBefore ?? true),
        nameOf,
        onJump: message.seq !== null ? jumpTo : null,
        opener,
      });
    },
    [message, nameOf, jumpTo],
  );

  if (message.body.type !== 'text') return null;

  if (uploads.length > 0) {
    const status = uploadStatusShown(uploads);
    const bottom = solo ? (status ? '' : '-mb-[4px]') : 'mb-1.5';
    return (
      <div className={`first:-mt-[4px] not-first:mt-1 ${bottom}`}>
        <PendingAlbum uploads={uploads} overlay={status ? undefined : overlay} />
        {status && <UploadStatus uploads={uploads} message={message} />}
        {status && solo && (
          <div className="mt-1 flex justify-end">
            <BubbleMeta message={message} tick={tick} floating={false} />
          </div>
        )}
      </div>
    );
  }

  if (message.attachments.length === 0) return null;

  if (parked || unknown) {
    return (
      <div className={`first:-mt-[4px] not-first:mt-1 ${solo ? '-mb-[4px]' : 'mb-1.5'}`}>
        <LocalAlbum
          conversationId={message.conversationId}
          attachments={message.attachments}
          parked={parked}
          overlay={overlay}
        />
      </div>
    );
  }

  return (
    <div className={`first:-mt-[4px] not-first:mt-1 ${solo ? '-mb-[4px]' : 'mb-1.5'}`}>
      <SentAlbum
        conversationId={message.conversationId}
        attachments={message.attachments}
        overlay={overlay}
        onOpen={open}
      />
    </div>
  );
});
