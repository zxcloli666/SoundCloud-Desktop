import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from '../../../lib/icons';
import {
  banMember,
  kickMember,
  muteMember,
  setModerator,
  unmuteMember,
} from '../../../lib/together/room-actions';
import { type MemberActions, MUTE_MINUTES } from '../../../lib/together/room-rules';
import type { RoomMember } from '../../../lib/together/types';
import { Avatar } from '../../ui/Avatar';
import { MicOff, ShieldMinus, ShieldPlus, UserX } from './icons';

interface MemberMenuProps {
  member: RoomMember;
  actions: MemberActions;
  muted: boolean;
  onDone: () => void;
}

function Item({
  icon,
  label,
  danger,
  disabled,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const tone = danger
    ? 'text-rose-200/90 hover:bg-rose-400/[0.12] hover:text-rose-100'
    : 'text-ink-75 hover:bg-ink/[0.07] hover:text-white';
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[12.5px] font-medium transition-colors disabled:cursor-default disabled:text-ink-25 disabled:hover:bg-transparent ${tone}`}
    >
      <span className="flex w-4 shrink-0 justify-center opacity-80">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function MuteRow({ onMute }: { onMute: (minutes: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className="px-2.5 pt-2 pb-1.5">
      <div className="flex items-center gap-2.5 text-[12.5px] font-medium text-ink-75">
        <MicOff size={14} className="shrink-0 opacity-80" />
        <span className="min-w-0 truncate">{t('chat.room.menu.mute')}</span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 pl-[26px]">
        {MUTE_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            role="menuitem"
            onClick={() => onMute(minutes)}
            className="h-7 cursor-pointer rounded-full bg-ink/[0.06] text-[11.5px] font-semibold tabular-nums text-ink-75 transition-colors hover:bg-rose-400/20 hover:text-rose-100"
          >
            {t('chat.room.menu.minutes', { value: minutes })}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MemberMenu({ member, actions, muted, onDone }: MemberMenuProps) {
  const { t } = useTranslation();
  const [banArmed, setBanArmed] = useState(false);
  const act = (task: () => Promise<boolean>) => {
    onDone();
    void task();
  };

  return (
    <div role="menu">
      <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-2">
        <Avatar src={member.avatarUrl} alt="" size={28} />
        <span className="min-w-0 truncate text-[13px] font-semibold text-ink-90">
          {member.name}
        </span>
      </div>
      <div className="mx-2 mb-1 h-px bg-ink/[0.06]" />
      {actions.mute &&
        (muted ? (
          <Item
            icon={<MicOff size={14} />}
            label={t('chat.room.menu.unmute')}
            onSelect={() => act(() => unmuteMember(member.userId))}
          />
        ) : (
          <MuteRow onMute={(minutes) => act(() => muteMember(member.userId, minutes))} />
        ))}
      {actions.moderator && (
        <Item
          icon={actions.moderator === 'add' ? <ShieldPlus size={14} /> : <ShieldMinus size={14} />}
          label={t(
            actions.moderatorsFull
              ? 'chat.room.menu.moderatorsFull'
              : actions.moderator === 'add'
                ? 'chat.room.menu.makeModerator'
                : 'chat.room.menu.dropModerator',
          )}
          disabled={actions.moderatorsFull}
          onSelect={() => act(() => setModerator(member.userId, actions.moderator === 'add'))}
        />
      )}
      <div className="mx-2 my-1 h-px bg-ink/[0.06]" />
      {actions.kick && (
        <Item
          icon={<UserX size={14} />}
          label={t('chat.room.menu.kick')}
          onSelect={() => act(() => kickMember(member.userId))}
        />
      )}
      {actions.ban && (
        <Item
          danger
          icon={<Ban size={14} />}
          label={t(banArmed ? 'chat.room.menu.banConfirm' : 'chat.room.menu.ban')}
          onSelect={() => (banArmed ? act(() => banMember(member.userId)) : setBanArmed(true))}
        />
      )}
    </div>
  );
}
