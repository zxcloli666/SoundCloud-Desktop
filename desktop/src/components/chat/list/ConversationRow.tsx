import { type KeyboardEvent, type MouseEvent, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, Timer } from '../../../lib/chat/icons';
import { ink } from '../../../lib/chat/tone';
import type { ConversationSummary, ConvId, Message, UserId } from '../../../lib/chat/types';
import { Ellipsis, Lock } from '../../../lib/icons';
import { useChatStore } from '../../../stores/chat';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { ConversationAvatar } from './ConversationAvatar';
import { conversationAvatar, conversationTitle } from './conversation-meta';
import { isMuted } from './mute';
import { RowBadges } from './RowBadges';
import { RowPreview } from './RowPreview';
import { rowTime } from './row-time';

export const ROW_HEIGHT = 64;

const RECENT_SCAN = 50;

const SELECTED = {
  background: `linear-gradient(180deg, var(--color-chat-tint), transparent), ${ink(6)}`,
  boxShadow: `inset 0 0.5px 0 ${ink(14)}`,
};

function hasFailed(messages: Message[] | undefined): boolean {
  if (!messages) return false;
  const from = Math.max(0, messages.length - RECENT_SCAN);
  for (let index = messages.length - 1; index >= from; index -= 1) {
    if (messages[index].state === 'failed') return true;
  }
  return false;
}

function typingCount(users: UserId[] | undefined, me: UserId | null): number {
  if (!users) return 0;
  return users.filter((userId) => userId !== me).length;
}

export type RowMenu = (
  event: Pick<MouseEvent, 'clientX' | 'clientY' | 'preventDefault'>,
  conversation: ConversationSummary,
) => void;

interface ConversationRowProps {
  conversation: ConversationSummary;
  selected: boolean;
  onOpen: (conversationId: ConvId) => void;
  onMenu: RowMenu;
}

export const ConversationRow = memo(function ConversationRow({
  conversation,
  selected,
  onOpen,
  onMenu,
}: ConversationRowProps) {
  const { t, i18n } = useTranslation();
  const myId = useChatStore((state) => state.status?.userId ?? null);
  const typing = useChatThreadStore((state) =>
    typingCount(state.threads[conversation.id]?.typing, myId),
  );
  const messages = useChatThreadStore((state) => state.threads[conversation.id]?.messages);
  const failed = useMemo(() => hasFailed(messages), [messages]);
  const now = Date.now();
  const muted = isMuted(conversation, now);
  const title = conversationTitle(conversation, t);
  const fresh = conversation.unread > 0 && !muted;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(conversation.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      data-ui="chat-row"
      data-kind={conversation.kind}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(conversation.id)}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => onMenu(event, conversation)}
      className={`group relative mx-2 my-0.5 flex h-[60px] cursor-pointer items-center gap-3 rounded-2xl px-2.5 outline-none transition-colors duration-200 focus-visible:ring-1 focus-visible:ring-ink/20 ${
        selected ? '' : 'hover:bg-ink/[0.05]'
      }`}
      style={selected ? SELECTED : undefined}
    >
      {fresh && !selected && (
        <span
          aria-hidden
          className="absolute top-1/2 left-0 h-6 w-[3px] -translate-y-1/2 rounded-full"
          style={{ background: 'var(--color-accent)' }}
        />
      )}
      <ConversationAvatar
        kind={conversation.kind}
        src={conversationAvatar(conversation)}
        name={title}
        size={44}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`truncate text-[13.5px] tracking-tight ${
              fresh ? 'font-bold text-ink' : 'font-semibold text-ink-85'
            }`}
          >
            {title}
          </span>
          {conversation.historyLocked && <Lock size={11} className="shrink-0 text-ink-30" />}
          {conversation.ttlS !== null && <Timer size={11} className="shrink-0 text-ink-35" />}
          {muted && <BellOff size={11} className="shrink-0 text-ink-30" />}
          <span
            className={`ml-auto shrink-0 pl-2 text-[11px] tabular-nums transition-opacity duration-150 group-hover:opacity-0 ${
              fresh ? 'text-[var(--color-accent)]' : 'text-ink-35'
            }`}
          >
            {conversation.lastAt > 0 ? rowTime(conversation.lastAt, now, i18n.language) : ''}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-45">
          <RowPreview
            conversation={conversation}
            typing={typing}
            mine={myId !== null && conversation.preview?.sender === myId}
          />
          <span className="ml-auto shrink-0">
            <RowBadges conversation={conversation} failed={failed} />
          </span>
        </div>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('chat.list.menu.more')}
        onClick={(event) => {
          event.stopPropagation();
          onMenu(event, conversation);
        }}
        className="absolute top-2 right-2 flex size-6 cursor-pointer items-center justify-center rounded-full text-ink-45 opacity-0 transition-opacity duration-150 hover:bg-ink/[0.08] hover:text-ink-85 group-hover:opacity-100"
      >
        <Ellipsis size={14} />
      </button>
    </div>
  );
});
