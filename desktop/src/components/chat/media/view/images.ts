import { chatBridge } from '../../../../lib/chat/bridge';
import type { MediaId } from '../../../../lib/chat/media-types';
import type { ClientId, ConvId, Message, Millis, Seq, UserId } from '../../../../lib/chat/types';

export interface ViewImage {
  conversationId: ConvId;
  seq: Seq | null;
  clientId: ClientId;
  mediaId: MediaId;
  w: number;
  h: number;
  position: number;
  count: number;
  sender: UserId;
  ts: Millis;
}

export interface ImagePage {
  images: ViewImage[];
  oldest: Seq | null;
  more: boolean;
}

const HISTORY_PAGE = 200;
const PAGES_PER_STEP = 4;
const WANT_PER_STEP = 24;

export function imagesOf(message: Message): ViewImage[] {
  if (message.body.type !== 'text') return [];
  const count = message.attachments.length;
  return message.attachments.map((attachment, position) => ({
    conversationId: message.conversationId,
    seq: message.seq,
    clientId: message.clientId,
    mediaId: attachment.mediaId,
    w: attachment.w,
    h: attachment.h,
    position,
    count,
    sender: message.sender,
    ts: message.ts,
  }));
}

export function threadImages(messages: Message[]): ViewImage[] {
  const images: ViewImage[] = [];
  for (const message of messages) {
    if (message.seq !== null && message.attachments.length > 0) images.push(...imagesOf(message));
  }
  return images;
}

function bySeq(a: Message, b: Message): number {
  return (a.seq ?? 0) - (b.seq ?? 0);
}

export async function imagesBefore(conversationId: ConvId, before: Seq | null): Promise<ImagePage> {
  const found: Message[] = [];
  let cursor = before;
  let more = true;
  let images = 0;
  for (let page = 0; page < PAGES_PER_STEP && more && images < WANT_PER_STEP; page++) {
    const result = await chatBridge.history(conversationId, {
      before: cursor,
      limit: HISTORY_PAGE,
    });
    const sent = result.messages.filter((message) => message.seq !== null);
    more = result.more && sent.length > 0;
    if (sent.length === 0) break;
    sent.sort(bySeq);
    cursor = sent[0].seq;
    for (const message of sent) {
      if (message.attachments.length > 0 && message.body.type === 'text') {
        found.push(message);
        images += message.attachments.length;
      }
    }
  }
  found.sort(bySeq);
  return {
    images: found.flatMap(imagesOf),
    oldest: cursor,
    more,
  };
}

export function sameImage(a: ViewImage, b: ViewImage): boolean {
  return a.mediaId === b.mediaId && a.clientId === b.clientId;
}
