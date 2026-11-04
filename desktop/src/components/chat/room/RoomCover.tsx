import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomCover as Cover } from '../../../lib/chat/media-types';
import { ChevronRight, ImageIcon } from '../../../lib/icons';
import type { RoomView } from '../../../lib/together/types';
import { isRoomHost, useTogetherStore } from '../../../stores/together';
import { ArtImage } from './perks/ArtImage';
import { CoverPicker } from './perks/CoverPicker';
import { roomArt } from './perks/perks';
import { StarMark } from './perks/StarMark';
import { RoomPopover } from './RoomPopover';
import { usePending } from './usePending';

function sameCover(a: Cover | null, b: Cover | null): boolean {
  return (a?.url ?? null) === (b?.url ?? null) && (a?.accent ?? null) === (b?.accent ?? null);
}

export const RoomCover = memo(function RoomCover({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const host = useTogetherStore(isRoomHost);
  const [open, setOpen] = useState(false);
  const [shown, show] = usePending(room.cover ?? null, sameCover);
  if (!host || !room.perks) return null;

  const star = room.perks.starHost;
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
              <ArtImage src={art.src} seed={art.src} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={11} />
            )}
          </span>
          <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">
            {t('chat.room.perks.cover.title')}
          </span>
          {!star && <StarMark size={14} lock />}
          <ChevronRight size={13} className="shrink-0 text-ink-35" />
        </button>
      }
    >
      <CoverPicker
        room={room}
        onSaved={(cover) => {
          show(cover, async () => true);
          setOpen(false);
        }}
      />
    </RoomPopover>
  );
});
