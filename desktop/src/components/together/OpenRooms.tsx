import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { ChevronLeft, Loader2, Radio, RefreshCw, Users } from '../../lib/icons';
import { openRoomErrorKey } from '../../lib/together/errors';
import { joinOpenSession } from '../../lib/together/session';
import type { OpenRoom } from '../../lib/together/types';
import { useTogetherStore } from '../../stores/together';
import { Avatar } from '../ui/Avatar';
import type { OpenRooms as OpenRoomsState } from './useOpenRooms';

const SKELETON_ROWS = [0, 1, 2];

interface RowProps {
  room: OpenRoom;
  joining: boolean;
  disabled: boolean;
  onJoin: () => void;
}

function RoomRow({ room, joining, disabled, onJoin }: RowProps) {
  const { t } = useTranslation();
  const cover = art(room.track?.artworkUrl, 't200x200');
  const track = room.track
    ? [room.track.title, room.track.artist].filter(Boolean).join(' · ')
    : t('together.nothingYet');
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-ink/[0.035]">
      <div className="relative shrink-0">
        <div className="h-10 w-10 overflow-hidden rounded-lg bg-ink/[0.06]">
          {cover && (
            <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
          )}
        </div>
        <Avatar
          src={room.hostAvatarUrl}
          alt={room.hostName}
          size={18}
          className="absolute -right-1 -bottom-1 ring-2 ring-surface"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-ink-90">{room.hostName}</p>
        <p className="truncate text-[11px] text-ink-45">{track}</p>
      </div>
      <span
        className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums ${
          room.full ? 'text-amber-200/80' : 'text-ink-45'
        }`}
      >
        <Users size={11} />
        {room.listeners}/{room.capacity}
      </span>
      <button
        type="button"
        disabled={room.full || disabled}
        onClick={onJoin}
        className="flex h-7 min-w-[58px] shrink-0 cursor-pointer items-center justify-center rounded-lg bg-ink/[0.08] px-2.5 text-[11.5px] font-semibold text-ink-80 transition-all duration-200 hover:bg-accent hover:text-accent-contrast active:scale-95 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-ink/[0.08] disabled:hover:text-ink-80"
      >
        {joining ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          t(room.full ? 'together.open.full' : 'together.join')
        )}
      </button>
    </li>
  );
}

function Placeholder() {
  return (
    <ul className="space-y-0.5">
      {SKELETON_ROWS.map((row) => (
        <li key={row} className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-ink/[0.06]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 animate-pulse rounded-full bg-ink/[0.07]" />
            <div className="h-2 w-36 animate-pulse rounded-full bg-ink/[0.05]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Notice({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-7 text-center">
      <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.05] text-ink-35">
        <Radio size={18} />
      </span>
      <p className="text-[12.5px] font-semibold text-ink-75">{title}</p>
      {hint && <p className="mt-1 text-[11.5px] leading-snug text-ink-40">{hint}</p>}
    </div>
  );
}

export function OpenRooms({ list, onBack }: { list: OpenRoomsState; onBack: () => void }) {
  const { t } = useTranslation();
  const connecting = useTogetherStore((s) => s.phase === 'connecting');
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { rooms, loading, failed, refresh } = list;

  const join = (hostId: string) => {
    setJoining(hostId);
    setError(null);
    joinOpenSession(hostId)
      .catch((e: unknown) => {
        setError(openRoomErrorKey(e));
        refresh();
      })
      .finally(() => setJoining(null));
  };

  return (
    <div className="relative">
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          title={t('together.open.back')}
          aria-label={t('together.open.back')}
          onClick={onBack}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-55 transition-all duration-200 hover:bg-ink/[0.08] hover:text-ink active:scale-90"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="flex-1 text-[13px] font-semibold text-ink-90">{t('together.open.title')}</p>
        <button
          type="button"
          title={t('together.open.refresh')}
          aria-label={t('together.open.refresh')}
          disabled={loading}
          onClick={refresh}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-ink-55 transition-all duration-200 hover:bg-ink/[0.08] hover:text-ink active:scale-90 disabled:cursor-default"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {!rooms && loading && <Placeholder />}
      {!rooms && !loading && failed && <Notice title={t('together.open.failed')} />}
      {rooms?.length === 0 && (
        <Notice title={t('together.open.empty')} hint={t('together.open.emptyHint')} />
      )}
      {rooms && rooms.length > 0 && (
        <ul className="max-h-[300px] space-y-0.5 overflow-y-auto pr-0.5">
          {rooms.map((room) => (
            <RoomRow
              key={room.hostId}
              room={room}
              joining={joining === room.hostId}
              disabled={joining != null || connecting}
              onJoin={() => join(room.hostId)}
            />
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-center text-[11px] text-rose-300/90">{t(error)}</p>}
    </div>
  );
}
