import type { ChatEventMap, ChatEventName } from '../../../lib/chat/events';
import type { MediaId, UploadView } from '../../../lib/chat/media-types';
import type { MediaMark } from './pictures';
import type { RoomOptions } from './room-data';
import type { CommandHandler, LabWorld } from './world';

export interface LabKit {
  world: LabWorld;
  star(on: boolean): void;
  handle(command: string, handler: CommandHandler): void;
  emit<K extends ChatEventName>(event: K, payload: ChatEventMap[K]): void;
  mark(ids: MediaId | MediaId[], mark: MediaMark | null): void;
  uploads(views: UploadView[]): void;
  room(options?: Partial<RoomOptions>): void;
  dock(view: string | null): void;
  after(step: () => void | Promise<void>): void;
  click(selector: string): void;
  waitFor(selector: string): void;
  wait(ms: number): void;
}

export interface LabScene {
  id: string;
  title: string;
  route: string;
  setup?: (kit: LabKit) => void | Promise<void>;
}
