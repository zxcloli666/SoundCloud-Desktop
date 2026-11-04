import { type ComponentType, memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '../../../lib/chat/icons';
import { ChevronRight, Eye, EyeOff, ImageIcon, Star } from '../../../lib/icons';
import { openRoomDock } from '../../../lib/together/room-chat';
import type { RoomView } from '../../../lib/together/types';
import { useBackdropStore } from '../../../stores/chat/backdrop';
import { BackdropThumb } from './BackdropThumb';
import { useRoomBackdrop } from './backdrop/shown';
import { useRoomSelf } from './useRoom';

type IconType = ComponentType<{ size?: number; className?: string }>;

function Row({
  icon: Icon,
  label,
  onClick,
  trailing,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-ink/[0.05]"
    >
      <Icon size={14} className="shrink-0 text-ink-45" />
      <span className="flex-1 truncate text-[12.5px] font-semibold text-ink-85">{label}</span>
      {trailing}
    </button>
  );
}

function Swatch({ room }: { room: RoomView }) {
  const backdrop = room.backdrop ?? null;
  return (
    <span className="relative h-5 w-8 shrink-0 overflow-hidden rounded-md bg-ink/[0.06] ring-1 ring-ink/10">
      {backdrop?.kind === 'preset' && <BackdropThumb backdrop={backdrop} />}
      {backdrop?.kind === 'image' && (
        <span className="absolute inset-0 flex items-center justify-center text-ink-55">
          <ImageIcon size={11} />
        </span>
      )}
    </span>
  );
}

function HostEntry({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const open = useBackdropStore((state) => state.open);
  const star = room.perks?.starHost === true;
  return (
    <Row
      icon={ImageIcon}
      label={t('chat.backdrop.title')}
      onClick={() => {
        openRoomDock();
        open('picker');
      }}
      trailing={
        <>
          {star ? (
            <Swatch room={room} />
          ) : (
            <Star size={11} fill="currentColor" className="shrink-0 text-accent" />
          )}
          <ChevronRight size={13} className="shrink-0 text-ink-30" />
        </>
      }
    />
  );
}

function MemberEntry({ room }: { room: RoomView }) {
  const { t } = useTranslation();
  const { conversationId, imageId, hidden } = useRoomBackdrop(room);
  const hide = useBackdropStore((state) => state.hide);
  const show = useBackdropStore((state) => state.show);
  const open = useBackdropStore((state) => state.open);
  if (!conversationId || !imageId) return null;
  return (
    <>
      <Row
        icon={hidden ? Eye : EyeOff}
        label={t(hidden ? 'chat.backdrop.show' : 'chat.backdrop.hide')}
        onClick={() => (hidden ? show(conversationId, imageId) : hide(conversationId, imageId))}
      />
      <Row icon={Flag} label={t('chat.backdrop.report.entry')} onClick={() => open('report')} />
    </>
  );
}

export const BackdropEntry = memo(function BackdropEntry({ room }: { room: RoomView }) {
  const self = useRoomSelf(room);
  return self.host ? <HostEntry room={room} /> : <MemberEntry room={room} />;
});
