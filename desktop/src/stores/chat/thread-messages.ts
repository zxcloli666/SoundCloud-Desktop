import type {
  ConversationSummary,
  ConvId,
  GoneMessage,
  Message,
  PeerMark,
  ReactionGroup,
  Seq,
} from '../../lib/chat/types';

function order(a: Message, b: Message): number {
  if (a.seq !== null && b.seq !== null) return a.seq - b.seq;
  if (a.seq !== null) return -1;
  if (b.seq !== null) return 1;
  return a.ts - b.ts;
}

export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  if (incoming.length === 0) return current;
  const index = new Map(current.map((message, at) => [message.clientId, at]));
  const next = current.slice();
  for (const message of incoming) {
    const at = index.get(message.clientId);
    if (at === undefined) {
      index.set(message.clientId, next.length);
      next.push(message);
    } else {
      next[at] = message;
    }
  }
  for (let i = 1; i < next.length; i++) {
    if (order(next[i - 1], next[i]) > 0) return next.sort(order);
  }
  return next;
}

export function withPins(pins: Seq[], incoming: Message[]): Seq[] {
  let next = pins;
  for (const message of incoming) {
    if (message.seq === null) continue;
    const has = next.includes(message.seq);
    if (message.pinned && !has) next = [...next, message.seq].sort((a, b) => a - b);
    if (!message.pinned && has) next = next.filter((seq) => seq !== message.seq);
  }
  return next;
}

export function toggleReaction(groups: ReactionGroup[], emoji: string): ReactionGroup[] {
  const found = groups.find((group) => group.emoji === emoji);
  if (!found) return [...groups, { emoji, count: 1, mine: true }];
  if (!found.mine) {
    return groups.map((group) =>
      group.emoji === emoji ? { ...group, count: group.count + 1, mine: true } : group,
    );
  }
  if (found.count <= 1) return groups.filter((group) => group.emoji !== emoji);
  return groups.map((group) =>
    group.emoji === emoji ? { ...group, count: group.count - 1, mine: false } : group,
  );
}

export function withSystemChanges(
  conversation: ConversationSummary | null,
  incoming: Message[],
): ConversationSummary | null {
  if (!conversation) return conversation;
  let next = conversation;
  for (const message of incoming) {
    if (message.body.type !== 'system') continue;
    if (message.body.kind === 'ttl') next = { ...next, ttlS: message.body.ttlS };
    if (message.body.kind === 'renamed') next = { ...next, title: message.body.name };
  }
  return next;
}

export function withMarks(current: PeerMark[], incoming: PeerMark[]): PeerMark[] {
  const byUser = new Map(current.map((mark) => [mark.userId, mark]));
  for (const mark of incoming) byUser.set(mark.userId, mark);
  return [...byUser.values()];
}

export function oldestSeq(messages: Message[]): Seq | null {
  return messages.find((message) => message.seq !== null)?.seq ?? null;
}

export function outgoing(messages: Message[]): Message[] {
  return messages.filter((message) => message.seq === null);
}

export function findBySeq(messages: Message[], seq: Seq): Message | null {
  let low = 0;
  let high = messages.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const current = messages[middle].seq;
    if (current === seq) return messages[middle];
    if (current === null || current > seq) high = middle - 1;
    else low = middle + 1;
  }
  return null;
}

interface MessageSet {
  messages: Message[];
  pins: Seq[];
}

export function withoutSeqs<T extends MessageSet>(thread: T, seqs: Set<Seq>): T {
  return {
    ...thread,
    messages: thread.messages.filter((message) => message.seq === null || !seqs.has(message.seq)),
    pins: thread.pins.filter((seq) => !seqs.has(seq)),
  };
}

export function goneByConversation(gone: GoneMessage[]): Map<ConvId, Set<Seq>> {
  const byConversation = new Map<ConvId, Set<Seq>>();
  for (const item of gone) {
    const seqs = byConversation.get(item.conversationId) ?? new Set<Seq>();
    seqs.add(item.seq);
    byConversation.set(item.conversationId, seqs);
  }
  return byConversation;
}

export function expiredSeqs(messages: Message[], now: number): Set<Seq> {
  const seqs = new Set<Seq>();
  for (const message of messages) {
    if (message.seq !== null && message.expiresAt !== null && message.expiresAt <= now) {
      seqs.add(message.seq);
    }
  }
  return seqs;
}
