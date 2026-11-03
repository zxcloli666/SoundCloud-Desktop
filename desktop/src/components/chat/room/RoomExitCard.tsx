import { type ComponentType, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from '../../../lib/chat/icons';
import { Clock } from '../../../lib/icons';
import type { RoomExit } from '../../../lib/together/room-rules';
import { useChatRoomStore } from '../../../stores/chat/room';
import { UserX } from './icons';

interface ExitLook {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  ring: string;
  title: string;
}

const LOOKS: Record<RoomExit, ExitLook> = {
  ended: {
    icon: Hourglass,
    ring: 'border-amber-200/30 bg-amber-300/[0.12] text-amber-200',
    title: 'chat.room.exit.ended',
  },
  kicked: {
    icon: UserX,
    ring: 'border-rose-300/30 bg-rose-400/[0.12] text-rose-300',
    title: 'chat.room.exit.kicked',
  },
  evicted: {
    icon: Clock,
    ring: 'border-ink/15 bg-ink/[0.05] text-ink-75',
    title: 'chat.room.exit.evicted',
  },
};

export const RoomExitCard = memo(function RoomExitCard({
  exit,
  code,
}: {
  exit: RoomExit;
  code: string | null;
}) {
  const { t } = useTranslation();
  const look = LOOKS[exit];
  const Icon = look.icon;

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-4 px-8 text-center">
      <span
        className={`chat-motion flex size-16 items-center justify-center rounded-full border ${look.ring} animate-[room-rise_0.5s_var(--ease-apple)_both]`}
      >
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <div className="space-y-1.5">
        <p className="text-[15px] font-bold tracking-tight text-ink-90">{t(look.title)}</p>
        {code && (
          <p className="font-mono text-[12px] tracking-[0.22em] text-ink-30 line-through decoration-white/20">
            {code}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => useChatRoomStore.getState().dismiss()}
        className="h-9 cursor-pointer rounded-full bg-ink/[0.08] px-5 text-[13px] font-semibold text-ink-80 transition-colors hover:bg-ink/[0.13] hover:text-white"
      >
        {t('chat.room.exit.close')}
      </button>
    </div>
  );
});
