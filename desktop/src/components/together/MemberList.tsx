import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Crown, Loader2, Shield } from '../../lib/icons';
import {
  hasModeration,
  isModerator,
  type MemberActions,
  memberActions,
  mutedUntil,
} from '../../lib/together/room-rules';
import type { RoomMember, RoomView } from '../../lib/together/types';
import { selectChatEnabled, useChatStore } from '../../stores/chat';
import { MicOff } from '../chat/room/icons';
import { MemberMenu } from '../chat/room/MemberMenu';
import { RoomPopover } from '../chat/room/RoomPopover';
import { Avatar } from '../ui/Avatar';

function MemberState({ member, room }: { member: RoomMember; room: RoomView }) {
  const { t } = useTranslation();
  const online = room.online.includes(member.userId);
  const urn = room.playback.trackUrn;
  if (!online) {
    return (
      <span className="text-[10.5px] font-medium text-ink-30">{t('together.member.away')}</span>
    );
  }
  if (member.userId === room.hostId || !urn) return null;
  if (member.readyUrn === urn) {
    return (
      <span className="flex items-center gap-1 text-[10.5px] font-medium text-ok/80">
        <Check size={11} strokeWidth={3} />
        {t('together.member.ready')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10.5px] font-medium text-ink-40">
      <Loader2 size={11} className="animate-spin" />
      {t('together.member.loading')}
    </span>
  );
}

function RoleChip({ room, member }: { room: RoomView; member: RoomMember }) {
  const { t } = useTranslation();
  if (member.userId === room.hostId) {
    return (
      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-300/[0.12] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-amber-200/90">
        <Crown size={9} strokeWidth={2.6} />
        {t('together.member.host')}
      </span>
    );
  }
  if (!isModerator(room, member.userId)) return null;
  return (
    <span
      title={t('chat.room.role.moderator')}
      className="flex shrink-0 items-center rounded-full bg-sky-300/[0.12] px-1 py-px text-sky-200/90"
    >
      <Shield size={10} strokeWidth={2.6} />
    </span>
  );
}

interface RowProps {
  room: RoomView;
  member: RoomMember;
  selfId: string | null;
  muted: boolean;
}

function Row({ room, member, selfId, muted }: RowProps) {
  const { t } = useTranslation();
  const online = room.online.includes(member.userId);
  return (
    <>
      <div className="relative shrink-0">
        <Avatar
          src={member.avatarUrl}
          alt={member.name}
          size={28}
          className={online ? '' : 'opacity-40 grayscale'}
        />
        <span
          className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#101012] ${
            online ? 'bg-[#3ddc84]' : 'bg-ink/20'
          }`}
        />
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span
          className={`truncate text-[12.5px] font-medium ${online ? 'text-ink-85' : 'text-ink-40'}`}
        >
          {member.name}
        </span>
        <RoleChip room={room} member={member} />
        {muted && <MicOff size={11} className="shrink-0 text-rose-300/90" />}
        {member.userId === selfId && (
          <span className="shrink-0 rounded-full bg-ink/[0.07] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-ink-45">
            {t('together.member.you')}
          </span>
        )}
      </div>
      <MemberState member={member} room={room} />
    </>
  );
}

const ROW = 'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors';

function ModeratedRow(props: RowProps & { actions: MemberActions }) {
  const [open, setOpen] = useState(false);
  return (
    <RoomPopover
      open={open}
      onOpenChange={setOpen}
      width={268}
      trigger={
        <button type="button" className={`${ROW} cursor-pointer hover:bg-ink/[0.05]`}>
          <Row {...props} />
        </button>
      }
    >
      <MemberMenu
        member={props.member}
        actions={props.actions}
        muted={props.muted}
        onDone={() => setOpen(false)}
      />
    </RoomPopover>
  );
}

export function MemberList({ room, selfId }: { room: RoomView; selfId: string | null }) {
  const chatOn = useChatStore(selectChatEnabled);
  const moderation = chatOn && hasModeration(room);
  const now = room.serverNow;
  return (
    <ul className="max-h-[188px] space-y-0.5 overflow-y-auto pr-0.5">
      {room.members.map((member) => {
        const actions = moderation ? memberActions(room, selfId, member.userId) : null;
        const props = {
          room,
          member,
          selfId,
          muted: mutedUntil(room, member.userId, now) !== null,
        };
        return (
          <li key={member.userId}>
            {actions ? (
              <ModeratedRow {...props} actions={actions} />
            ) : (
              <div className={`${ROW} hover:bg-ink/[0.035]`}>
                <Row {...props} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
