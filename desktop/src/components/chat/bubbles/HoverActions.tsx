import { type MouseEvent, memo, type ReactNode } from 'react';
import { Reply, Smile } from '../../../lib/chat/icons';
import { surface } from '../../../lib/chat/tone';
import { Ellipsis } from '../../../lib/icons';
import { useThread } from '../thread/context';

export const QUICK_REACTION = '❤️';

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      className="flex size-[26px] cursor-pointer items-center justify-center rounded-full text-ink-55 transition-colors duration-100 hover:bg-ink/[0.09] hover:text-white"
    >
      {children}
    </button>
  );
}

export const HoverActions = memo(function HoverActions({
  mine,
  canReact,
  canReply,
  onQuick,
  onPicker,
  onReply,
  onMenu,
}: {
  mine: boolean;
  canReact: boolean;
  canReply: boolean;
  onQuick: () => void;
  onPicker: (event: MouseEvent<HTMLButtonElement>) => void;
  onReply: () => void;
  onMenu: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const { t } = useThread();
  return (
    <div
      className={`chat-thread-motion absolute -top-5 z-10 flex items-center gap-px rounded-full border border-ink/[0.09] p-[2px] shadow-[0_6px_18px_rgba(0,0,0,0.45)] ${
        mine ? 'left-2' : 'right-2'
      }`}
      style={{ background: surface(11), animation: 'chat-thread-rise 120ms ease-out' }}
    >
      {canReact && (
        <>
          <ActionButton label={t('chat.thread.actions.quickReact')} onClick={onQuick}>
            <span className="text-[13px] leading-none">{QUICK_REACTION}</span>
          </ActionButton>
          <ActionButton label={t('chat.thread.actions.react')} onClick={onPicker}>
            <Smile size={14} />
          </ActionButton>
        </>
      )}
      {canReply && (
        <ActionButton label={t('chat.thread.actions.reply')} onClick={onReply}>
          <Reply size={14} />
        </ActionButton>
      )}
      <ActionButton label={t('chat.thread.actions.more')} onClick={onMenu}>
        <Ellipsis size={14} />
      </ActionButton>
    </div>
  );
});
