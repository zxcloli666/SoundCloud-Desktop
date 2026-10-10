import * as Popover from '@radix-ui/react-popover';
import React, { type ComponentPropsWithoutRef, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from '../../lib/icons';
import { useTogetherStore } from '../../stores/together';
import { Avatar } from '../ui/Avatar';
import { LiveView } from './LiveView';
import { StartView } from './StartView';

const STACK_LIMIT = 3;

const Trigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<'button'>>((props, ref) => {
  const { t } = useTranslation();
  const room = useTogetherStore((s) => s.room);
  const reconnecting = useTogetherStore((s) => s.phase === 'reconnecting');

  if (!room) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        title={t('together.title')}
        aria-label={t('together.title')}
        className="w-[30px] h-[30px] rounded-full flex items-center justify-center transition-all duration-200 ease-[var(--ease-apple)] cursor-pointer text-white/55 hover:text-white hover:bg-white/[0.08] hover:-translate-y-px active:scale-90"
      >
        <Users size={16} />
      </button>
    );
  }

  const online = room.members.filter((m) => room.online.includes(m.userId));
  const stack = online.slice(0, STACK_LIMIT);
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      title={t('together.title')}
      aria-label={t('together.title')}
      className="relative flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full bg-accent/15 pr-2.5 pl-1 text-accent shadow-[0_0_14px_-4px_var(--color-accent-glow)] transition-all duration-200 ease-[var(--ease-apple)] hover:bg-accent/25 active:scale-95"
    >
      <Users size={15} className="together-icon ml-1" />
      <span className="together-stack flex -space-x-1.5">
        {stack.map((member) => (
          <Avatar
            key={member.userId}
            src={member.avatarUrl}
            alt={member.name}
            size={22}
            className="ring-2 ring-[#16161a]"
          />
        ))}
      </span>
      <span className="text-[12px] font-semibold tabular-nums">{online.length}</span>
      <span
        className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${
          reconnecting
            ? 'bg-amber-300'
            : 'animate-pulse bg-accent shadow-[0_0_6px_var(--color-accent-glow)]'
        }`}
      />
    </button>
  );
});

export const TogetherButton = React.memo(() => {
  const room = useTogetherStore((s) => s.room);
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
          className="z-[200] w-[340px] origin-bottom-right rounded-[20px] border border-white/[0.10] bg-[#101012]/96 p-3.5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl outline-none data-[state=open]:animate-fade-in-up"
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-16 rounded-t-[20px] bg-gradient-to-b from-accent/[0.07] to-transparent" />
          {room ? <LiveView room={room} /> : <StartView />}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
