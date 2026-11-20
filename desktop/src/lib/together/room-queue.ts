import { useChatRoomStore } from '../../stores/chat/room';
import { useTogetherStore } from '../../stores/together';
import { onChatEvent } from '../chat/events';
import { serverTime } from './link';
import { queueSuggestion } from './room-actions';
import { isHost, moderatorPick } from './room-rules';

const MAX_AGE_MS = 120_000;
const queued = new Set<string>();

export function startRoomQueue(): void {
  void onChatEvent('chat:messages', (event) => {
    if (event.origin !== 'sync') return;
    const { room, selfId } = useTogetherStore.getState();
    if (!room || !isHost(room, selfId)) return;
    if (useChatRoomStore.getState().conversationId !== event.conversationId) return;
    for (const message of event.messages) {
      const body = message.body;
      if (body.type !== 'system' || !body.track || !moderatorPick(room, body)) continue;
      const key = `${event.conversationId}:${message.seq ?? message.clientId}`;
      if (queued.has(key) || serverTime() - message.ts > MAX_AGE_MS) continue;
      if (room.playback.trackUrn === body.track.urn) continue;
      queued.add(key);
      void queueSuggestion(body.track.urn);
    }
  });
}
