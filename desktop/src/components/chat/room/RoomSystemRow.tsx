import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { SystemEvent, UserId } from '../../../lib/chat/types';
import { Shield } from '../../../lib/icons';
import { roomRowKind } from '../../../lib/together/room-rows';
import { SuggestCard } from './SuggestCard';
import { TrackChangeRow } from './TrackChangeRow';

export interface RoomSystemRowProps {
  event: SystemEvent;
  nameOf: (userId: UserId | null) => string;
}

function ModeratorRow({ name, on }: { name: string; on: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-center px-6 pt-2.5 pb-0.5">
      <span className="inline-flex max-w-full items-center gap-1.5 px-3 py-1 text-[11.5px] text-ink-45">
        <Shield size={12} className="shrink-0 text-sky-300/80" />
        <span className="min-w-0 truncate">
          {t(on ? 'chat.room.moderatorRow' : 'chat.room.moderatorOffRow', { name })}
        </span>
      </span>
    </div>
  );
}

export const RoomSystemRow = memo(function RoomSystemRow({ event, nameOf }: RoomSystemRowProps) {
  const kind = roomRowKind(event);
  if (kind === 'track' && event.track) return <TrackChangeRow track={event.track} />;
  if (kind === 'suggest' && event.track) {
    return <SuggestCard track={event.track} by={event.name ?? nameOf(event.actor)} />;
  }
  if (kind === 'moderator') {
    return <ModeratorRow name={event.name ?? nameOf(event.target)} on={event.on !== false} />;
  }
  return null;
});
