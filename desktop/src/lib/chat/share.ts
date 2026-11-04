import { toast } from 'sonner';
import i18n from '../../i18n';
import { useChatEmbedsStore } from '../../stores/chat/embeds';
import { useChatListStore } from '../../stores/chat/list';
import { type Track, usePlayerStore } from '../../stores/player';
import { isRoomGuest, useTogetherStore } from '../../stores/together';
import { idOf } from '../ids';
import { sessionErrorKey } from '../together/errors';
import { roomTitle } from '../together/room-rules';
import { hostSession } from '../together/session';
import { chatBridge } from './bridge';
import { roomInviteEmbed, trackEmbed } from './embed-snapshot';
import type { ConvId, Embed } from './types';

const SEND_PARALLEL = 4;

export interface ShareResult {
  sent: ConvId[];
  failed: ConvId[];
}

export function openShare(embed: Embed | null): void {
  if (embed) useChatEmbedsStore.getState().openShare(embed);
}

export function shareTrack(track: Track, atMs: number | null = null): void {
  openShare(trackEmbed(track, atMs));
}

export async function sendEmbed(
  targets: ConvId[],
  embed: Embed,
  comment: string,
): Promise<ShareResult> {
  const text = { text: comment.trim(), spans: [] };
  const result: ShareResult = { sent: [], failed: [] };
  for (let start = 0; start < targets.length; start += SEND_PARALLEL) {
    const part = targets.slice(start, start + SEND_PARALLEL);
    const settled = await Promise.allSettled(
      part.map((conversationId) => chatBridge.send({ conversationId, text, embeds: [embed] })),
    );
    part.forEach((id, i) => {
      if (settled[i].status === 'fulfilled') result.sent.push(id);
      else result.failed.push(id);
    });
  }
  return result;
}

export function currentRoomInvite(): Embed | null {
  const room = useTogetherStore.getState().room;
  if (!room) return null;
  const host = room.members.find((member) => member.userId === room.hostId)?.name ?? '';
  return roomInviteEmbed(room.code, roomTitle(room), host);
}

export function shareRoomInvite(): boolean {
  const invite = currentRoomInvite();
  openShare(invite);
  return invite !== null;
}

export async function listenTogether(track: Track): Promise<void> {
  if (isRoomGuest(useTogetherStore.getState())) return;
  if (!useTogetherStore.getState().room) {
    try {
      await hostSession(false);
    } catch (error) {
      toast.error(i18n.t(sessionErrorKey(error)));
      return;
    }
  }
  usePlayerStore.getState().play(track, [track]);
  shareRoomInvite();
}

export async function startDirectChat(userUrn: string): Promise<ConvId | null> {
  const userId = idOf(userUrn);
  if (!userId) return null;
  const conversation = await chatBridge.create({ kind: 'direct', members: [userId] });
  useChatListStore.getState().upsert(conversation);
  return conversation.id;
}
