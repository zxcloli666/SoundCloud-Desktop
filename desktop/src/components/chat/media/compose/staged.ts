import type { UploadView } from '../../../../lib/chat/media-types';
import type { ConvId, Message } from '../../../../lib/chat/types';
import { useChatMediaStore } from '../../../../stores/chat/media';
import { type ThreadState, useChatThreadStore } from '../../../../stores/chat/thread';

export interface AlbumFlags {
  sending: Record<string, true>;
  parked: Record<string, true>;
  parkedReady: boolean;
  dismissed: Record<string, true>;
}

function posted(messages: Message[] | null): Set<string> | null {
  return messages ? new Set(messages.map((message) => message.clientId)) : null;
}

function unsent(upload: UploadView, sent: Set<string> | null, flags: AlbumFlags): boolean {
  if (upload.kind !== 'image') return false;
  if (flags.sending[upload.album] || flags.parked[upload.album]) return false;
  return sent ? !sent.has(upload.album) : flags.parkedReady;
}

export function stagedUploads(
  conversationId: ConvId,
  uploads: UploadView[],
  messages: Message[] | null,
  flags: AlbumFlags,
): UploadView[] {
  const sent = posted(messages);
  const mine = uploads.filter(
    (upload) =>
      upload.conversationId === conversationId &&
      !flags.dismissed[upload.album] &&
      unsent(upload, sent, flags),
  );
  const album = mine.reduce<UploadView | null>(
    (latest, upload) => (latest && latest.updatedAt >= upload.updatedAt ? latest : upload),
    null,
  )?.album;
  return mine.filter((upload) => upload.album === album).sort((a, b) => a.position - b.position);
}

export function readyMessages(thread: ThreadState | undefined): Message[] | null {
  return thread?.load === 'ready' ? thread.messages : null;
}

export function hiddenAlbumKey(
  uploads: UploadView[],
  threads: Record<ConvId, ThreadState>,
  flags: AlbumFlags,
): string {
  const sent = new Map<ConvId, Set<string> | null>();
  const hidden = new Set<string>();
  for (const upload of uploads) {
    if (!sent.has(upload.conversationId)) {
      sent.set(upload.conversationId, posted(readyMessages(threads[upload.conversationId])));
    }
    const unposted = unsent(upload, sent.get(upload.conversationId) ?? null, flags);
    if (flags.dismissed[upload.album] || unposted) hidden.add(upload.album);
  }
  return [...hidden].sort().join(',');
}

export function albumFlags(): AlbumFlags {
  const { sending, parked, parkedReady, dismissed } = useChatMediaStore.getState();
  return { sending, parked, parkedReady, dismissed };
}

export function stagedNow(conversationId: ConvId): UploadView[] {
  const thread = useChatThreadStore.getState().threads[conversationId];
  return stagedUploads(
    conversationId,
    useChatMediaStore.getState().uploads,
    readyMessages(thread),
    albumFlags(),
  );
}
