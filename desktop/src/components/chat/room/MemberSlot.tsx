import { useState } from 'react';
import type { MemberActions } from '../../../lib/together/room-rules';
import type { RoomMember } from '../../../lib/together/types';
import { useOpenProfile } from '../profile';
import { MemberMenu } from './MemberMenu';
import { MemberPuck, type PuckState } from './MemberPuck';
import { RoomPopover } from './RoomPopover';

interface MemberSlotProps {
  member: RoomMember;
  state: PuckState;
  actions: MemberActions | null;
}

export function MemberSlot({ member, state, actions }: MemberSlotProps) {
  const [open, setOpen] = useState(false);
  const openProfile = useOpenProfile();
  if (!actions) {
    return (
      <MemberPuck
        member={member}
        state={state}
        actionable
        onClick={() => openProfile(member.userId)}
      />
    );
  }
  return (
    <RoomPopover
      open={open}
      onOpenChange={setOpen}
      width={268}
      trigger={<MemberPuck member={member} state={state} actionable />}
    >
      <MemberMenu
        member={member}
        actions={actions}
        muted={state.muted}
        onDone={() => setOpen(false)}
      />
    </RoomPopover>
  );
}
