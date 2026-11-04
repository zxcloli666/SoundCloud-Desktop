import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { MediaUploadsEvent } from './media-types';
import type {
  ChatStatus,
  DeviceAddedEvent,
  GoneEvent,
  MessagesEvent,
  NotifyOpenEvent,
  SyncEvent,
  TypingEvent,
} from './types';

export const CHAT_EVENTS = {
  status: 'chat:status',
  sync: 'chat:sync',
  messages: 'chat:messages',
  typing: 'chat:typing',
  gone: 'chat:gone',
  deviceAdded: 'chat:device-added',
  notifyOpen: 'chat:notify-open',
  mediaUploads: 'chat:media-uploads',
} as const;

export interface ChatEventMap {
  'chat:status': ChatStatus;
  'chat:sync': SyncEvent;
  'chat:messages': MessagesEvent;
  'chat:typing': TypingEvent;
  'chat:gone': GoneEvent;
  'chat:device-added': DeviceAddedEvent;
  'chat:notify-open': NotifyOpenEvent;
  'chat:media-uploads': MediaUploadsEvent;
}

export type ChatEventName = keyof ChatEventMap;

export function onChatEvent<K extends ChatEventName>(
  name: K,
  handler: (payload: ChatEventMap[K]) => void,
): Promise<UnlistenFn> {
  return listen<ChatEventMap[K]>(name, (event) => handler(event.payload));
}
