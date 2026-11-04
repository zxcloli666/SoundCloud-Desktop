import { useEffect, useMemo, useState } from 'react';
import type { ConvId, Member } from '../../../lib/chat/types';
import { serverTime } from '../../../lib/together/link';
import {
  canModerate,
  chatMembers,
  isHost,
  linksOff,
  linksOpenAt,
  mutedUntil,
  type RoomLinkBlock,
} from '../../../lib/together/room-rules';
import type { RoomView } from '../../../lib/together/types';
import { useChatRoomStore } from '../../../stores/chat/room';
import { useTogetherStore } from '../../../stores/together';

export interface RoomSelf {
  id: string | null;
  host: boolean;
  moderates: boolean;
}

export function useRoom(): RoomView | null {
  return useTogetherStore((state) => state.room);
}

export function useRoomSelf(room: RoomView | null): RoomSelf {
  const id = useTogetherStore((state) => state.selfId);
  const host = !!room && isHost(room, id);
  const moderates = !!room && canModerate(room, id);
  return useMemo(() => ({ id, host, moderates }), [id, host, moderates]);
}

export function useServerNow(stepMs: number, active: boolean): number {
  const [now, setNow] = useState(serverTime);
  useEffect(() => {
    if (!active) return;
    setNow(serverTime());
    const timer = setInterval(() => setNow(serverTime()), stepMs);
    return () => clearInterval(timer);
  }, [stepMs, active]);
  return now;
}

export function useMutedUntil(room: RoomView | null, userId: string | null): number | null {
  const pending = room?.muted?.some((entry) => entry.userId === userId) ?? false;
  const now = useServerNow(1_000, pending);
  return room ? mutedUntil(room, userId, now) : null;
}

function useOurRoom(conversationId: ConvId): RoomView | null {
  const ours = useChatRoomStore((state) => state.conversationId === conversationId);
  return useTogetherStore((state) => (ours ? state.room : null));
}

export function useRoomModerator(conversationId: ConvId): boolean {
  const room = useOurRoom(conversationId);
  const self = useTogetherStore((state) => state.selfId);
  return room !== null && canModerate(room, self);
}

export function useRoomSendLock(conversationId: ConvId): number | null {
  const room = useOurRoom(conversationId);
  const self = useTogetherStore((state) => state.selfId);
  return useMutedUntil(room, self);
}

export function useRoomMembers(conversationId: ConvId): Member[] | undefined {
  const room = useOurRoom(conversationId);
  return useMemo(() => (room ? chatMembers(room) : undefined), [room]);
}

function useServerAfter(at: number): boolean {
  const [passed, setPassed] = useState(() => serverTime() >= at);
  useEffect(() => {
    const left = at - serverTime();
    setPassed(left <= 0);
    if (left <= 0) return;
    const timer = setTimeout(() => setPassed(true), left);
    return () => clearTimeout(timer);
  }, [at]);
  return passed;
}

export function useRoomLinkBlock(conversationId: ConvId): RoomLinkBlock {
  const room = useOurRoom(conversationId);
  const self = useTogetherStore((state) => state.selfId);
  const open = useServerAfter(room ? linksOpenAt(room, self) : 0);
  if (!room) return null;
  if (linksOff(room, self)) return 'off';
  return open ? null : 'new';
}
