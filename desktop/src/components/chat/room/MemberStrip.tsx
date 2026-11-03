import { memo, type ReactNode } from 'react';
import {
  isModerator,
  memberActions,
  mutedUntil,
  orderedMembers,
} from '../../../lib/together/room-rules';
import type { RoomView } from '../../../lib/together/types';
import { MemberSlot } from './MemberSlot';
import { useServerNow } from './useRoom';

const MUTE_TICK_MS = 15_000;

interface MemberStripProps {
  room: RoomView;
  selfId: string | null;
  moderation: boolean;
  trailing?: ReactNode;
}

export const MemberStrip = memo(function MemberStrip({
  room,
  selfId,
  moderation,
  trailing,
}: MemberStripProps) {
  const now = useServerNow(MUTE_TICK_MS, (room.muted?.length ?? 0) > 0);

  return (
    <div className="flex shrink-0 items-start gap-0.5 overflow-x-auto border-b border-ink/[0.05] px-2 py-2 [scrollbar-width:none]">
      {orderedMembers(room).map((member) => (
        <MemberSlot
          key={member.userId}
          member={member}
          actions={moderation ? memberActions(room, selfId, member.userId) : null}
          state={{
            online: room.online.includes(member.userId),
            host: member.userId === room.hostId,
            moderator: isModerator(room, member.userId),
            muted: mutedUntil(room, member.userId, now) !== null,
            self: member.userId === selfId,
          }}
        />
      ))}
      {trailing}
    </div>
  );
});
