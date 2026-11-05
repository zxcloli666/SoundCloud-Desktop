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
  newest: Seq | null;
  more: boolean;
}

const POSTS_PER_STEP = 24;

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
  const page = await chatBridge.images(conversationId, before, POSTS_PER_STEP);
  const posts = page.messages
    .filter((message) => message.seq !== null && message.attachments.length > 0)
    .sort(bySeq);
  return {
    images: posts.flatMap(imagesOf),
    oldest: posts[0]?.seq ?? before,
    newest: posts[posts.length - 1]?.seq ?? null,
    more: page.more,
  };
}

export function sameImage(a: ViewImage, b: ViewImage): boolean {
  return a.mediaId === b.mediaId && a.clientId === b.clientId;
}
