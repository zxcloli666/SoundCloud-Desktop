import * as Popover from '@radix-ui/react-popover';
import React, { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from '../../lib/icons';
import { selectRoomThread, useChatRoomStore } from '../../stores/chat/room';
import { useTogetherStore } from '../../stores/together';
import { useOpenRoomChat } from '../chat/shell/useOpenChat';
import { playerBtn } from '../layout/player/button-class';
import { LiveView } from './LiveView';
import { StartView } from './StartView';

const Trigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>((props, ref) => {
  const { t } = useTranslation();
  const room = useTogetherStore((s) => s.room);
  const reconnecting = useTogetherStore((s) => s.phase === 'reconnecting');
  const online = room ? room.members.filter((m) => room.online.includes(m.userId)).length : 0;

  return (
    <button
      {...props}
      ref={ref}
      type="button"
      data-ui="player-together"
      title={t('together.title')}
      aria-label={t('together.title')}
      className={`relative ${playerBtn(room !== null)}`}
    >
      <Users size={16} />
      {room && (
        <span
          className={`pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-[14px] min-w-[14px] items-center justify-center rounded-full px-[3px] text-[9px] font-semibold leading-none tabular-nums text-accent-contrast ${
            reconnecting ? 'bg-ink/40' : 'bg-accent'
          }`}
        >
          {online}
        </span>
      )}
    </button>
  );
});

export const TogetherButton = React.memo(() => {
  const room = useTogetherStore((s) => s.room);
  const docked = useChatRoomStore((s) => selectRoomThread(s) !== null);
  const openRoom = useOpenRoomChat();
  if (room && docked) return <Trigger onClick={openRoom} />;
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Trigger />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={10}
          collisionPadding={12}
          className="z-[200] w-[340px] origin-bottom-right rounded-[20px] border border-ink/[0.10] bg-surface/96 p-3.5 shadow-[0_18px_60px_rgb(var(--shade)/calc(0.55*var(--shade-alpha)))] backdrop-blur-xl outline-none data-[state=open]:animate-fade-in-up"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[20px] bg-gradient-to-b from-accent/[0.07] to-transparent" />
          {room ? <LiveView room={room} /> : <StartView />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
