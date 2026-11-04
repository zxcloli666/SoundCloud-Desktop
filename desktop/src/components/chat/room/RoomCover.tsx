import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomCover as Cover } from '../../../lib/chat/media-types';
import { ChevronRight, ImageIcon } from '../../../lib/icons';
import type { RoomView } from '../../../lib/together/types';
import { isRoomHost, useTogetherStore } from '../../../stores/together';
import { CoverPicker } from './perks/CoverPicker';
import { roomArt, roomPerks } from './perks/perks';
import { StarMark } from './perks/StarMark';
import { RoomPopover } from './RoomPopover';

const PENDING_MS = 5_000;

function coverKey(cover: Cover | null | undefined): string {
  return cover ? `${cover.url}|${cover.accent}` : '';
}

function usePendingCover(actual: Cover | null | undefined) {
  const [pending, setPending] = useState<{ cover: Cover | null } | null>(null);
  const actualKey = coverKey(actual);
  const pendingKey = pending ? coverKey(pending.cover) : null;

  useEffect(() => {
    if (pendingKey === null) return;
    if (pendingKey === actualKey) {
      setPending(null);
      return;
    }
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [actualKey, pendingKey]);

  return [
    pending ? pending.cover : (actual ?? null),
    (cover: Cover | null) => setPending({ cover }),
  ] as const;
}

export const RoomCover = memo(function RoomCover({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = usePendingCover(room.cover);
  if (!host) return null;

  const star = roomPerks(room).starHost;
  const track = room.playback.track;
  const art = roomArt(
    star ? shown : null,
    track ? track.artwork_url || track.user?.avatar_url : null,
    't67x67',
  );

  return (
    <RoomPopover
      open={open}
      onOpenChange={setOpen}
      width={300}
      trigger={
        <button
          type="button"
          data-ui="room-cover"
          aria-haspopup="dialog"
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.05]"
        >
          <span
            className="flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-ink/[0.08] text-ink-35"
            style={art.accent ? { boxShadow: `0 0 0 1.5px ${art.accent}` } : undefined}
          >
            {art.src ? (
              <img src={art.src} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={11} />
            )}
          </span>
          <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">
            {t('chat.room.perks.cover.title')}
          </span>
          {!star && <StarMark size={14} />}
          <ChevronRight size={13} className="shrink-0 text-ink-35" />
        </button>
      }
    >
      <CoverPicker
        room={room}
        onSaved={(cover) => {
          setShown(cover);
          setOpen(false);
        }}
      />
    </RoomPopover>
  );
});
