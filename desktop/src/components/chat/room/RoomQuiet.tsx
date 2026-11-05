import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from '../../../lib/chat/icons';
import { Loader2, RotateCcw } from '../../../lib/icons';
import { retryRoomChat } from '../../../lib/together/room-chat';
import type { RoomChatLink } from '../../../lib/together/room-chat-state';

export const RoomQuiet = memo(function RoomQuiet({
  link,
  purged,
}: {
  link: RoomChatLink;
  purged: boolean;
}) {
  const { t } = useTranslation();
  if (link === 'idle' || link === 'opening') {
    return (
      <div className="flex h-full items-center justify-center text-ink-35">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }
  const failed = link === 'failed';
  const text = purged
    ? 'chat.room.quiet.gone'
    : failed
      ? 'chat.room.quiet.failed'
      : 'chat.room.quiet.off';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-ink/[0.05] text-ink-35">
        <MessageCircle size={20} />
      </span>
      <p className="text-[13px] font-semibold text-ink-60">{t(text)}</p>
      {failed && (
        <button
          type="button"
          onClick={retryRoomChat}
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.08] px-4 text-[12.5px] font-semibold text-ink-75 transition-colors hover:bg-ink/[0.13] hover:text-ink"
        >
          <RotateCcw size={13} />
          {t('chat.room.quiet.retry')}
        </button>
      )}
    </div>
  );
});
