import type { MediaRef, MediaUrl, MinePage, MineQuery } from '../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type {
  ConversationPatch,
  ConversationSummary,
  Message,
  SendInput,
  ThreadSnapshot,
} from '../../../lib/chat/types';
import { CONV } from './convs';
import { deleteSelection, restoreSelection, type Selection } from './media-trash';
import { writeHandlers } from './media-writes';
import { ME_ID, person } from './people';
import { markMedia, mediaMark } from './pictures';
import { conversation, world } from './world';

type Args = Record<string, unknown>;

function summary(id: string): ConversationSummary {
  const found = conversation(id);
  if (!found) throw { code: 'not_found' };
  return found;
}

function snapshot(id: string): ThreadSnapshot {
  return {
    conversation: summary(id),
    messages: world.threads[id] ?? [],
    moreBefore: false,
    marks: [],
    pins: [],
    typing: [],
    draft: null,
  };
}

function patched(id: string, patch: ConversationPatch): ConversationSummary {
  const found = summary(id);
  const next: ConversationSummary = {
    ...found,
    title: patch.meta?.title === undefined ? found.title : patch.meta.title,
    avatarMediaId: patch.avatar?.kind === 'clear' ? null : found.avatarMediaId,
    pinnedAt:
      patch.me?.pinned === undefined || patch.me.pinned === null
        ? found.pinnedAt
        : patch.me.pinned
          ? Date.now()
          : null,
    archived: patch.me?.archived ?? found.archived,
  };
  world.conversations = world.conversations.map((c) => (c.id === id ? next : c));
  return next;
}

function sent(input: SendInput): Message {
  const thread = world.threads[input.conversationId] ?? [];
  const seq = thread.length + 1;
  const message: Message = {
    conversationId: input.conversationId,
    seq,
    clientId: input.clientId ?? `lab-${seq}`,
    sender: ME_ID,
    senderDevice: null,
    mine: true,
    ts: Date.now(),
    editedAt: null,
    expiresAt: null,
    state: 'sent',
    body: { type: 'text', ...input.text },
    replyTo: input.replyTo ?? null,
    mentions: [],
    mentionsMe: false,
    embeds: input.embeds,
    attachments: [],
    forwardedFrom: null,
    reactions: [],
    pinned: false,
    localOnly: false,
  };
  world.threads[input.conversationId] = [...thread, message];
  return message;
}

function mediaUrls(args: Args): { expires_in_s: number; items: MediaUrl[] } {
  const conversationId = String(args.conversationId ?? '');
  const ids = (args.ids as string[]) ?? [];
  const items = ids.map((id): MediaUrl => {
    const mark = mediaMark(id);
    if (mark === 'deleted') return { state: 'deleted', id };
    if (mark === 'lost') return { state: 'lost', id };
    return { state: 'ok', id, url: chatMediaUrl(conversationId, id, 'image') };
  });
  return { expires_in_s: 900, items };
}

function minePage(query: MineQuery): MinePage {
  let items = [...world.mine];
  if (query.conversationId) items = items.filter((m) => m.conversation_id === query.conversationId);
  if (query.order === 'old') items.sort((a, b) => a.created_at - b.created_at);
  else if (query.order === 'big') items.sort((a, b) => b.bytes - a.bytes);
  else items.sort((a, b) => b.created_at - a.created_at);
  const start = query.cursor ? Number(query.cursor) : 0;
  const limit = query.limit ?? 30;
  const end = start + limit;
  return { items: items.slice(start, end), next_cursor: end < items.length ? String(end) : null };
}

export const defaultHandlers: Record<string, (args: Args) => unknown> = {
  chat_status: () => world.status,
  chat_config: () => world.config,
  chat_device_limit: () => null,
  chat_keys_reset_plan: () =>
    world.status.phase === 'ready' && world.status.keyStorage === 'os' ? 'in_place' : 'file',
  chat_list: () => ({ items: world.conversations, nextCursor: null }),
  chat_requests: () => [],
  chat_open: (a) => snapshot(String(a.conversationId)),
  chat_history: () => ({ messages: [], more: false }),
  chat_images: () => ({ messages: [], more: false }),
  chat_members: (a) => world.members[String(a.conversationId)] ?? [],
  chat_send: (a) => sent(a.input as SendInput),
  chat_conversation_update: (a) => patched(String(a.conversationId), a.patch as ConversationPatch),
  chat_room_chat: () => summary('c-room'),
  chat_public_open: () => ({
    conversation: summary(CONV.public),
    online: summary(CONV.public).memberCount,
    mute: null,
    newcomer: null,
  }),
  chat_public_log: () => ({ entries: [], next: null }),
  chat_public_mute: () => Date.now() + 600_000,
  chat_public_unmute: () => null,
  chat_public_ban: () => null,
  chat_public_unban: () => null,
  chat_public_moderator: () => null,
  chat_public_people: (a) => (a.userIds as string[]).map((id) => person(id)),
  chat_public_slow_mode: (a) => summary(String(a.conversationId)),
  chat_settings_get: () => world.settings,
  chat_devices: () => [],
  chat_search: () => [],
  chat_embeds: () => ({ items: [], more: false }),
  chat_notify_prefs: () => ({ enabled: true, preview: 'full', sound: true, streamMode: false }),
  chat_media_usage: () => world.usage,
  chat_media_mine: (a) => minePage(a.query as MineQuery),
  chat_media_delete: (a) => deleteSelection(a.selection as Selection),
  chat_media_restore: (a) => restoreSelection(a.selection as Selection),
  chat_media_urls: mediaUrls,
  chat_media_known: (a) =>
    ((a.media as MediaRef[]) ?? [])
      .filter((ref) => mediaMark(ref.mediaId) === null)
      .map((ref) => ref.mediaId),
  chat_media_uploads: () => world.uploads,
  chat_media_parked: parkedAlbums,
  ...writeHandlers,
  chat_media_cache_size: () => 48 * 1024 * 1024,
  chat_media_cache_clear: () => 48 * 1024 * 1024,
  chat_media_retry: (a) => {
    const id = String(a.mediaId ?? '');
    if (mediaMark(id) === 'lost') markMedia([id], null);
    return null;
  },
};

function parkedAlbums(): string[] {
  const posted = new Set(
    Object.values(world.threads).flatMap((messages) => messages.map((message) => message.clientId)),
  );
  return [...new Set(world.uploads.map((upload) => upload.album))].filter((album) =>
    posted.has(album),
  );
}

export async function runChatCommand(cmd: string, args: Args): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, world.latencyMs));
  const handler = world.handlers[cmd] ?? defaultHandlers[cmd];
  if (!handler) {
    console.info(`[chat-lab] no handler for ${cmd}`);
    return null;
  }
  return handler(args);
}
