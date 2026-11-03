import { type ComponentPropsWithoutRef, forwardRef } from 'react';
import type { RoomMember } from '../../../lib/together/types';
import { Avatar } from '../../ui/Avatar';
import { MuteBadge, RoleBadge } from './MemberBadges';

export interface PuckState {
  online: boolean;
  host: boolean;
  moderator: boolean;
  muted: boolean;
  self: boolean;
}

interface MemberPuckProps extends ComponentPropsWithoutRef<'button'> {
  member: RoomMember;
  state: PuckState;
  actionable: boolean;
}

export const MemberPuck = forwardRef<HTMLButtonElement, MemberPuckProps>(function MemberPuck(
  { member, state, actionable, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      title={member.name}
      aria-label={member.name}
      disabled={!actionable}
      className="group flex w-[54px] shrink-0 cursor-pointer flex-col items-center gap-1 rounded-xl py-1 transition-colors enabled:hover:bg-ink/[0.05] disabled:cursor-default"
    >
      <span
        className="relative rounded-full transition-transform duration-200 group-enabled:group-hover:scale-[1.05]"
        style={
          state.self
            ? { boxShadow: '0 0 0 2px var(--color-chat-cutout), 0 0 0 3.5px var(--color-accent)' }
            : undefined
        }
      >
        <Avatar
          src={member.avatarUrl}
          alt=""
          size={36}
          className={state.online ? '' : 'opacity-40 grayscale'}
        />
        <RoleBadge host={state.host} moderator={state.moderator} />
        {state.muted && <MuteBadge />}
      </span>
      <span
        className={`w-full truncate px-0.5 text-center text-[10.5px] font-medium ${
          state.online ? 'text-ink-70' : 'text-ink-30'
        }`}
      >
        {member.name}
      </span>
    </button>
  );
});
