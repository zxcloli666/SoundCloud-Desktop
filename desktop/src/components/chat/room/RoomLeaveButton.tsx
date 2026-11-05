import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Power } from '../../../lib/icons';
import { nextHost } from '../../../lib/together/room-rules';
import { leaveSession } from '../../../lib/together/session';
import type { RoomView } from '../../../lib/together/types';

const ARMED_MS = 3_000;

export const RoomLeaveButton = memo(function RoomLeaveButton({
  room,
  host,
  selfId,
}: {
  room: RoomView;
  host: boolean;
  selfId: string | null;
}) {
  const { t } = useTranslation();
  const [armed, setArmed] = useState(false);
  const heir = host && selfId ? nextHost(room, selfId) : null;
  const ends = host && !heir;
  const label = t(ends ? 'chat.room.end' : 'chat.room.leave');
  const hint = heir ? t('chat.room.leaveHint', { name: heir.name }) : label;

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARMED_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const press = () => {
    if (armed) void leaveSession();
    else setArmed(true);
  };

  return (
    <button
      type="button"
      title={hint}
      aria-label={hint}
      onClick={press}
      className={`flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full transition-colors duration-200 ${
        armed
          ? 'bg-rose-400/20 pr-3 pl-2.5 text-rose-200'
          : 'w-7 justify-center text-ink-45 hover:bg-rose-400/[0.12] hover:text-rose-200'
      }`}
    >
      <Power size={13} />
      {armed && (
        <span className="text-[12px] font-semibold">
          {t(ends ? 'chat.room.confirmEnd' : 'chat.room.confirmLeave')}
        </span>
      )}
    </button>
  );
});
