import { memo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { surface } from '../../../lib/chat/tone';
import { Crown } from '../../../lib/icons';
import { useChatRoomStore } from '../../../stores/chat/room';

const SHOWN_MS = 8_000;

export const HandoffBanner = memo(function HandoffBanner() {
  const { t } = useTranslation();
  const handoff = useChatRoomStore((state) => state.handoff);

  useEffect(() => {
    if (!handoff) return;
    const left = handoff.at + SHOWN_MS - Date.now();
    const timer = setTimeout(() => useChatRoomStore.getState().setHandoff(null), Math.max(0, left));
    return () => clearTimeout(timer);
  }, [handoff]);

  if (!handoff) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center px-3">
      <div
        role="status"
        className="chat-motion flex max-w-full items-center gap-2 rounded-full border border-amber-200/25 py-1.5 pr-3.5 pl-1.5 text-[12px] font-semibold text-amber-100 shadow-[0_10px_30px_rgba(0,0,0,0.45)] animate-[room-drop_0.45s_var(--ease-apple)_both]"
        style={{ background: `color-mix(in srgb, var(--color-amber-300) 8%, ${surface(4)})` }}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-300 text-black">
          <Crown size={12} strokeWidth={2.6} />
        </span>
        <span className="truncate">
          {handoff.mine
            ? t('chat.room.handoff.mine')
            : t('chat.room.handoff.other', { name: handoff.name })}
        </span>
      </div>
    </div>
  );
});
