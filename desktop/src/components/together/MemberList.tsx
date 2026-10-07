import { useTranslation } from 'react-i18next';
import { Check, Crown, Loader2 } from '../../lib/icons';
import type { RoomMember, RoomView } from '../../lib/together/types';
import { Avatar } from '../ui/Avatar';

function MemberState({ member, room }: { member: RoomMember; room: RoomView }) {
  const { t } = useTranslation();
  const online = room.online.includes(member.userId);
  const urn = room.playback.trackUrn;
  if (!online) {
    return (
      <span className="text-[10.5px] font-medium text-white/30">{t('together.member.away')}</span>
    );
  }
  if (member.userId === room.hostId || !urn) return null;
  if (member.readyUrn === urn) {
    return (
      <span className="flex items-center gap-1 text-[10.5px] font-medium text-[#3ddc84]/80">
        <Check size={11} strokeWidth={3} />
        {t('together.member.ready')}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[10.5px] font-medium text-white/40">
      <Loader2 size={11} className="animate-spin" />
      {t('together.member.loading')}
    </span>
  );
}

export function MemberList({ room, selfId }: { room: RoomView; selfId: string | null }) {
  const { t } = useTranslation();
  return (
    <ul className="max-h-[188px] space-y-0.5 overflow-y-auto pr-0.5">
      {room.members.map((member) => {
        const online = room.online.includes(member.userId);
        const host = member.userId === room.hostId;
        return (
          <li
            key={member.userId}
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-white/[0.035]"
          >
            <div className="relative shrink-0">
              <Avatar
                src={member.avatarUrl}
                alt={member.name}
                size={28}
                className={online ? '' : 'opacity-40 grayscale'}
              />
              <span
                className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#101012] ${
                  online ? 'bg-[#3ddc84]' : 'bg-white/20'
                }`}
              />
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <span
                className={`truncate text-[12.5px] font-medium ${online ? 'text-white/85' : 'text-white/40'}`}
              >
                {member.name}
              </span>
              {host && (
                <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-300/[0.12] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-amber-200/90">
                  <Crown size={9} strokeWidth={2.6} />
                  {t('together.member.host')}
                </span>
              )}
              {member.userId === selfId && (
                <span className="shrink-0 rounded-full bg-white/[0.07] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.06em] text-white/45">
                  {t('together.member.you')}
                </span>
              )}
            </div>
            <MemberState member={member} room={room} />
          </li>
        );
      })}
    </ul>
  );
}
