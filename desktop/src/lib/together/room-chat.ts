import { type ChatState, selectChatEnabled, useChatStore } from '../../stores/chat';
import { useChatListStore } from '../../stores/chat/list';
import { DOCK_ROOM, useChatPrefsStore } from '../../stores/chat/prefs';
import { useChatRoomStore } from '../../stores/chat/room';
import { useTogetherStore } from '../../stores/together';
import { chatBridge } from '../chat/bridge';
import { chatError } from '../chat/errors';
import { onChatEvent } from '../chat/events';
import type { ConvId } from '../chat/types';
import { serverTime } from './link';
import {
  gone,
  moved,
  NO_ROOM_CHAT,
  nextStep,
  opened,
  opening,
  type RoomChatWish,
  refused,
  retry,
  retryDelay,
} from './room-chat-state';
import { hasLink, linkBlock, type RoomLinkBlock } from './room-rules';

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

function chatReady(state: ChatState): boolean {
  return selectChatEnabled(state) && state.status?.phase === 'ready';
}

function wish(): RoomChatWish | null {
  const { room, phase } = useTogetherStore.getState();
  if (!room || phase === 'idle' || phase === 'connecting') return null;
  if (room.chatEnabled !== true || !chatReady(useChatStore.getState())) return null;
  return { code: room.code, chatId: room.chatId ?? null };
}

function later(ms: number): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    useChatRoomStore.getState().apply(retry);
    sync();
  }, ms);
}

async function open(code: string): Promise<void> {
  useChatRoomStore.getState().apply(() => opening(code));
  try {
    const summary = await chatBridge.roomChat(code);
    failures = 0;
    useChatListStore.getState().upsert(summary);
    useChatRoomStore.getState().apply((state) => opened(state, code, summary.id));
  } catch (error) {
    const room = useChatRoomStore.getState();
    if (room.code !== code || room.exit !== null) return;
    const failure = chatError(error);
    const off = failure?.code === 'unavailable';
    room.apply((state) => refused(state, code, off));
    if (!off) later(retryDelay(failure?.code ?? null, failure?.retryMs, failures++));
  }
}

function sync(): void {
  const room = useChatRoomStore.getState();
  const step = nextStep(room, wish());
  if (step.kind === 'open' && step.code !== room.code) failures = 0;
  if (step.kind === 'open') void open(step.code);
  if (step.kind === 'move') room.apply((state) => moved(state, step.code));
  if (step.kind === 'clear') room.apply(() => NO_ROOM_CHAT);
}

export function openRoomDock(): void {
  useChatPrefsStore.getState().show(DOCK_ROOM);
}

export function roomLinkBlock(conversationId: ConvId, text: string): RoomLinkBlock {
  const { room, selfId } = useTogetherStore.getState();
  const ours = useChatRoomStore.getState().conversationId === conversationId;
  if (!room || !ours || !hasLink(text)) return null;
  return linkBlock(room, selfId, serverTime());
}

export function retryRoomChat(): void {
  failures = 0;
  useChatRoomStore.getState().apply(retry);
  sync();
}

export function startRoomChat(): void {
  useTogetherStore.subscribe((state, previous) => {
    if (state.room !== previous.room || state.phase !== previous.phase) sync();
  });
  useChatStore.subscribe((state, previous) => {
    if (chatReady(state) === chatReady(previous)) return;
    failures = 0;
    useChatRoomStore.getState().apply(retry);
    sync();
  });
  void onChatEvent('chat:gone', (event) =>
    useChatRoomStore.getState().apply((state) => gone(state, event.conversations)),
  );
  sync();
}
