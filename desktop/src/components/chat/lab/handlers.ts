import type {
  DeleteAnswer,
  MediaUrl,
  MinePage,
  MineQuery,
  RestoreAnswer,
  UploadView,
} from '../../../lib/chat/media-types';
import { chatMediaUrl } from '../../../lib/chat/media-url';
import type {
  ConversationPatch,
  ConversationSummary,
  Message,
  SendInput,
  ThreadSnapshot,
} from '../../../lib/chat/types';
import { emitChat } from './bus';
import { ME_ID } from './people';
import { mediaMark } from './pictures';
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
  return { expires_in_s: 3600, items };
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

function deleteMedia(args: Args): DeleteAnswer {
  const selection = args.selection as { ids?: string[]; all?: boolean };
  const gone = world.mine.filter((m) => selection.all || selection.ids?.includes(m.id));
  const freed = gone.reduce((sum, m) => sum + m.bytes, 0);
  world.mine = world.mine.filter((m) => !gone.includes(m));
  const used = Math.max(0, world.usage.bytes - freed);
  world.usage = { ...world.usage, bytes: used };
  return { deleted: gone.length, freed, used, quota: world.usage.quota };
}

function restoreMedia(): RestoreAnswer {
  return { restored: 0, missed: 0, used: world.usage.bytes, quota: world.usage.quota };
}

function setUploads(uploads: UploadView[], removed: string[] = []) {
  world.uploads = world.uploads.filter((u) => !removed.includes(u.id));
  for (const upload of uploads) {
    const index = world.uploads.findIndex((u) => u.id === upload.id);
    if (index >= 0) world.uploads[index] = upload;
    else world.uploads.push(upload);
  }
  emitChat('chat:media-uploads', { uploads, removed });
}

function retryUpload(args: Args) {
  const found = world.uploads.find((u) => u.id === args.id);
  if (found) setUploads([{ ...found, state: 'queued', attempts: found.attempts + 1 }]);
  return null;
}

function cancelUpload(args: Args) {
  setUploads([], [String(args.id)]);
  return null;
}

export const defaultHandlers: Record<string, (args: Args) => unknown> = {
  chat_status: () => world.status,
  chat_config: () => world.config,
  chat_list: () => ({ items: world.conversations, nextCursor: null }),
  chat_requests: () => [],
  chat_open: (a) => snapshot(String(a.conversationId)),
  chat_history: () => ({ messages: [], more: false }),
  chat_members: (a) => world.members[String(a.conversationId)] ?? [],
  chat_send: (a) => sent(a.input as SendInput),
  chat_conversation_update: (a) => patched(String(a.conversationId), a.patch as ConversationPatch),
  chat_room_chat: () => summary('c-room'),
  chat_settings_get: () => world.settings,
  chat_devices: () => [],
  chat_search: () => [],
  chat_embeds: () => ({ items: [], more: false }),
  chat_notify_prefs: () => ({ enabled: true, preview: 'full', sound: true, streamMode: false }),
  chat_media_usage: () => world.usage,
  chat_media_mine: (a) => minePage(a.query as MineQuery),
  chat_media_delete: deleteMedia,
  chat_media_restore: restoreMedia,
  chat_media_urls: mediaUrls,
  chat_media_uploads: () => world.uploads,
  chat_media_upload_retry: retryUpload,
  chat_media_upload_cancel: cancelUpload,
  chat_media_cache_size: () => 48 * 1024 * 1024,
  chat_media_cache_clear: () => 48 * 1024 * 1024,
};

export async function runChatCommand(cmd: string, args: Args): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, world.latencyMs));
  const handler = world.handlers[cmd] ?? defaultHandlers[cmd];
  if (!handler) {
    console.info(`[chat-lab] no handler for ${cmd}`);
    return null;
  }
  return handler(args);
}

export { setUploads };
