import type { TFunction } from 'i18next';
import { shortDate } from './time';
import type {
  ConversationSummary,
  DisappearingTtl,
  Message,
  PeerMark,
  Seq,
  SystemEvent,
  UserId,
} from './types';
import { DISAPPEARING_TTLS } from './types';

export type NameOf = (userId: UserId | null) => string;
export type Tick = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

const SNIPPET_MAX = 140;

export function conversationTitle(conversation: ConversationSummary, t: TFunction): string {
  if (conversation.kind === 'self') return t('chat.thread.saved');
  if (conversation.kind === 'public') return t('chat.public.title');
  return conversation.title?.trim() || conversation.peer?.name || t('chat.thread.untitled');
}

export function conversationAvatar(conversation: ConversationSummary): string | null {
  return conversation.avatarUrl ?? conversation.peer?.avatarUrl ?? null;
}

export function isKnownTtl(ttlS: number): ttlS is DisappearingTtl {
  return (DISAPPEARING_TTLS as readonly number[]).includes(ttlS);
}

export function ttlLabel(ttlS: number | null, t: TFunction): string {
  if (!ttlS) return t('chat.thread.ttl.off');
  if (isKnownTtl(ttlS)) return t(`chat.thread.ttl.${ttlS}`);
  return t('chat.thread.ttl.custom', { hours: Math.max(1, Math.round(ttlS / 3600)) });
}

export function ttlShort(ttlS: number, t: TFunction): string {
  return isKnownTtl(ttlS) ? t(`chat.thread.ttl.short.${ttlS}`) : ttlLabel(ttlS, t);
}

export function senderHue(userId: UserId): number {
  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.round((((hash >>> 0) * 0.618033988749895) % 1) * 360);
}

export function senderColor(userId: UserId): string {
  return `color-mix(in oklab, hsl(${senderHue(userId)} 75% 52%), var(--tone-hi) 45%)`;
}

function oneLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > SNIPPET_MAX ? `${line.slice(0, SNIPPET_MAX - 1)}…` : line;
}

export function messageSnippet(message: Message, t: TFunction): string {
  const { body } = message;
  if (body.type === 'text') {
    if (body.text.trim()) return oneLine(body.text);
    const embed = message.embeds[0];
    return embed ? oneLine(embed.title) : '';
  }
  if (body.type === 'deleted') return t('chat.thread.bubble.deleted');
  if (body.type === 'locked') return t('chat.thread.bubble.locked');
  if (body.type === 'unknown') return t('chat.thread.bubble.unknown');
  return t('chat.thread.bubble.system');
}

export function systemText(
  event: SystemEvent,
  nameOf: NameOf,
  t: TFunction,
  language: string,
): string {
  const actor = nameOf(event.actor);
  const target = nameOf(event.target ?? event.actor);
  switch (event.kind) {
    case 'ttl':
      return event.ttlS
        ? t('chat.thread.system.ttlOn', { ttl: ttlLabel(event.ttlS, t) })
        : t('chat.thread.system.ttlOff');
    case 'created':
      return t('chat.thread.system.created');
    case 'joined':
      return t('chat.thread.system.joined', { name: target });
    case 'left':
      return t('chat.thread.system.left', { name: target });
    case 'added':
      return t('chat.thread.system.added', { name: target });
    case 'removed':
      return t('chat.thread.system.removed', { name: target });
    case 'kicked':
      return t('chat.thread.system.kicked', { name: target });
    case 'banned':
      return t('chat.thread.system.banned', { name: target });
    case 'muted':
      return event.until
        ? t('chat.thread.system.mutedUntil', {
            name: target,
            time: shortDate(event.until, Date.now(), language),
          })
        : t('chat.thread.system.muted', { name: target });
    case 'renamed':
      return t('chat.thread.system.renamed', { name: event.name ?? '' });
    case 'handoff':
      return t('chat.thread.system.handoff', { name: target });
    case 'track':
      return t('chat.thread.system.track', { name: event.track?.title ?? actor });
    case 'role':
      return t(roleKey(event.role), { name: target });
    default:
      return t('chat.thread.system.other');
  }
}

function roleKey(role: SystemEvent['role']): string {
  if (role === 'owner') return 'chat.thread.system.roleOwner';
  if (role === 'admin') return 'chat.thread.system.roleAdmin';
  return 'chat.thread.system.roleMember';
}

export function peerSeqs(marks: PeerMark[], me: UserId | null): { read: Seq; delivered: Seq } {
  let read = 0;
  let delivered = 0;
  for (const mark of marks) {
    if (mark.userId === me) continue;
    read = Math.max(read, mark.readSeq);
    delivered = Math.max(delivered, mark.deliveredSeq, mark.readSeq);
  }
  return { read, delivered };
}

export function tickOf(message: Message, read: Seq, delivered: Seq): Tick {
  if (message.state === 'failed') return 'failed';
  if (message.state === 'pending' || message.seq === null) return 'pending';
  if (message.state === 'read' || read >= message.seq) return 'read';
  if (message.state === 'delivered' || delivered >= message.seq) return 'delivered';
  return 'sent';
}
