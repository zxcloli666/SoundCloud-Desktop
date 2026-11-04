import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId, Message } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { useChatThreadStore } from '../../../../stores/chat/thread';

export function stagedUploads(
  conversationId: ConvId,
  uploads: UploadView[],
  messages: Message[] | null,
  sending: Record<string, true>,
): UploadView[] {
  if (messages === null) return [];
  const posted = new Set(messages.map((message) => message.clientId));
  const mine = uploads.filter(
    (upload) =>
      upload.conversationId === conversationId &&
      upload.kind === 'image' &&
      !sending[upload.album] &&
      !posted.has(upload.album),
  );
  const album = mine.reduce<UploadView | null>(
    (latest, upload) => (latest && latest.updatedAt >= upload.updatedAt ? latest : upload),
    null,
  )?.album;
  return mine.filter((upload) => upload.album === album).sort((a, b) => a.position - b.position);
}

export function stagedNow(conversationId: ConvId): UploadView[] {
  const thread = useChatThreadStore.getState().threads[conversationId];
  const media = useChatMediaStore.getState();
  return stagedUploads(
    conversationId,
    media.uploads,
    thread?.load === 'ready' ? thread.messages : null,
    media.sending,
  );
}
