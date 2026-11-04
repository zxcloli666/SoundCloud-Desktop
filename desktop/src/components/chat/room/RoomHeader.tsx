import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass } from '../../../lib/chat/icons';
import { ChevronLeft } from '../../../lib/icons';
import type { RoomView } from '../../../lib/together/types';
import { SyncBadge } from '../../together/SyncBadge';
import { RoomAccessToggle } from './RoomAccessToggle';
import { RoomCodeChip } from './RoomCodeChip';
import { RoomLeaveButton } from './RoomLeaveButton';
import { RoomRules } from './RoomRules';
import { RoomSleeve } from './RoomSleeve';
import { RoomTitle } from './RoomTitle';
import { RoomTuning } from './RoomTuning';
import type { RoomSelf } from './useRoom';

function Ephemeral() {
  const { t } = useTranslation();
  return (
    <span
      title={t('chat.room.ephemeral')}
      aria-label={t('chat.room.ephemeral')}
      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-ink/[0.09] bg-black/25 text-amber-200/80"
    >
      <Hourglass size={13} />
    </span>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-label={t('chat.thread.back')}
      onClick={onBack}
      className="-ml-1 flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-55 transition-colors hover:bg-ink/[0.08] hover:text-ink @min-[641px]:hidden"
    >
      <ChevronLeft size={17} />
    </button>
  );
}

export const RoomHeader = memo(function RoomHeader({
  room,
  self,
  moderation,
  onBack,
}: {
  room: RoomView;
  self: RoomSelf;
  moderation: boolean;
  onBack?: () => void;
}) {
  return (
    <header className="relative shrink-0 border-b border-ink/[0.05]">
      <RoomSleeve room={room} />
      <div className="relative px-3 pt-3 pb-2.5" style={{ isolation: 'isolate' }}>
        <div className="flex items-center gap-2">
          {onBack && <BackButton onBack={onBack} />}
          <div className="flex min-w-0 flex-1">
            <RoomTitle room={room} editable={self.host && moderation} />
          </div>
          <Ephemeral />
          {room.public !== undefined && <RoomAccessToggle open={room.public} host={self.host} />}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <RoomCodeChip code={room.code} />
          <div className="flex min-w-0 flex-1">
            <SyncBadge className="min-w-0 max-w-full" />
          </div>
          {self.host && moderation && <RoomRules room={room} />}
          <RoomTuning room={room} />
          <RoomLeaveButton room={room} host={self.host} selfId={self.id} />
        </div>
      </div>
    </header>
  );
});
