import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { MediaStateEvent, MediaUploadErrorEvent, MediaUploadsEvent } from './media-types';
import type {
  ChatStatus,
  DeviceAddedEvent,
  DeviceLimit,
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
  mediaUploadError: 'chat:media-upload-error',
  mediaState: 'chat:media-state',
  deviceLimit: 'chat:device-limit',
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
  'chat:media-upload-error': MediaUploadErrorEvent;
  'chat:media-state': MediaStateEvent;
  'chat:device-limit': DeviceLimit;
}

export type ChatEventName = keyof ChatEventMap;

export function onChatEvent<K extends ChatEventName>(
  name: K,
  handler: (payload: ChatEventMap[K]) => void,
): Promise<UnlistenFn> {
  return listen<ChatEventMap[K]>(name, (event) => handler(event.payload));
}
