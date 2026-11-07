import { type FocusEvent, type MouseEvent, memo, useState } from 'react';
import type { Tick } from '../../../lib/chat/render';
import type { Message } from '../../../lib/chat/types';
import { EyeOff, RotateCcw } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { openContextMenu } from '../../../stores/context-menu';
import { Avatar } from '../../ui/Avatar';
import { useThread } from '../thread/context';
import { useThreadDialogs } from '../thread/dialogs';
import { toastError } from '../thread/errors';
import { isActiveMember } from '../thread/permissions';
import { Bubble } from './Bubble';
import { HoverActions, QUICK_REACTION } from './HoverActions';
import { messageMenu, moderationEntries, startReply } from './message-menu';
import { Reactions } from './Reactions';

export interface MessageRowProps {
  message: Message;
  replied: Message | null;
  first: boolean;
  last: boolean;
  tick: Tick | null;
  flash: boolean;
  avatars: boolean;
}

function BlockedRow({ first, onReveal }: { first: boolean; onReveal: () => void }) {
  const { t } = useThread();
  return (
    <div className={`flex px-3 ${first ? 'pt-2.5' : 'pt-[3px]'}`}>
      <button
        type="button"
        onClick={onReveal}
        className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-ink/[0.08] px-3 py-1 text-[11.5px] text-ink-35 transition-colors duration-150 hover:text-ink-60"
      >
        <EyeOff size={12} className="shrink-0" />
        {t('chat.thread.bubble.blocked')}
      </button>
    </div>
  );
}

export const MessageRow = memo(function MessageRow({
  message,
  replied,
  first,
  last,
  tick,
  flash,
  avatars,
}: MessageRowProps) {
  const { t, language, conversation, moderator, people, blocked, me } = useThread();
  const live = message.body.type === 'text' && message.seq !== null;
  const active = isActiveMember(conversation);
  const fail = (error: unknown) => toastError(error, t, language);
  const [hover, setHover] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const leave = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setHover(false);
  };

  const openMenu = (event: MouseEvent) =>
    openContextMenu(event, [
      ...messageMenu(message, conversation, moderator, t, language),
      ...moderationEntries(message, conversation, me, people, t),
    ]);
  const react = (emoji: string) =>
    void useChatThreadStore.getState().react(message, emoji).catch(fail);
  const openPicker = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    useThreadDialogs.getState().openPicker({ message, x: rect.left, y: rect.bottom });
  };
  const retry = () => void useChatThreadStore.getState().retry(message).catch(fail);

  if (!message.mine && !revealed && blocked.has(message.sender)) {
    return <BlockedRow first={first} onReveal={() => setRevealed(true)} />;
  }

  return (
    <div
      onContextMenu={openMenu}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={leave}
      className={`relative flex items-end gap-2 px-3 ${first ? 'pt-2.5' : 'pt-[3px]'} ${
        message.mine ? 'flex-row-reverse' : ''
      }`}
    >
      {avatars && !message.mine && (
        <div className="w-7 shrink-0 pb-px">
          {last && <Avatar src={people.get(message.sender)?.avatarUrl} size={28} />}
        </div>
      )}
      <div
        className={`relative flex min-w-0 max-w-[min(82%,560px)] flex-col ${
          message.mine ? 'items-end' : 'items-start'
        }`}
      >
        <Bubble
          message={message}
          replied={replied}
          tick={tick}
          first={first}
          last={last}
          flash={flash}
        />
        {message.reactions.length > 0 && (
          <Reactions
            reactions={message.reactions}
            mine={message.mine}
            onToggle={live && active ? react : () => undefined}
          />
        )}
        {hover && (
          <HoverActions
            mine={message.mine}
            canReact={live && active}
            canReply={live && active}
            onQuick={() => react(QUICK_REACTION)}
            onPicker={openPicker}
            onReply={() => startReply(message)}
            onMenu={openMenu}
          />
        )}
      </div>
      {tick === 'failed' && (
        <button
          type="button"
          aria-label={t('chat.thread.actions.retry')}
          title={t('chat.thread.actions.retry')}
          onClick={retry}
          className="mb-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-rose-400/60 text-rose-300 transition-colors duration-150 hover:bg-rose-400/15"
        >
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
});
