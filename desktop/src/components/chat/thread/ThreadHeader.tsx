import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BellOff, Timer } from '../../../lib/chat/icons';
import { conversationAvatar, conversationTitle, ttlShort } from '../../../lib/chat/render';
import { surface } from '../../../lib/chat/tone';
import type { UserId } from '../../../lib/chat/types';
import { Bookmark, ChevronLeft, Ellipsis, Info, Users } from '../../../lib/icons';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { Avatar } from '../../ui/Avatar';
import { useThread } from './context';
import { GlassLayer } from './GlassLayer';
import { hasTimer } from './permissions';
import { TypingBars } from './TypingBars';
import { isMuted, openThreadMenu, openTimerMenu } from './thread-menu';

const NO_TYPING: UserId[] = [];

function Subtitle({ typing }: { typing: UserId[] }) {
  const { t } = useTranslation();
  const { conversation, nameOf, me } = useThread();
  const others = typing.filter((userId) => userId !== me);
  if (others.length > 0) {
    const label =
      conversation.kind === 'direct'
        ? t('chat.thread.typing.one')
        : others.length === 1
          ? t('chat.thread.typing.named', { name: nameOf(others[0]) })
          : t('chat.thread.typing.many', { count: others.length });
    return (
      <span
        className="flex min-w-0 items-center gap-1.5"
        style={{ color: 'var(--color-accent-hover)' }}
      >
        <TypingBars />
        <span className="truncate">{label}</span>
      </span>
    );
  }
  if (conversation.kind === 'group' || conversation.kind === 'room') {
    return (
      <span className="flex items-center gap-1">
        <Users size={11} className="shrink-0" />
        {t('chat.thread.members', { count: conversation.memberCount })}
      </span>
    );
  }
  return null;
}

function GroupMark() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-ink-50">
      <Users size={16} />
    </span>
  );
}

function SavedMark() {
  return (
    <span
      className="flex size-9 shrink-0 items-center justify-center rounded-full"
      style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
    >
      <Bookmark size={16} />
    </span>
  );
}

export const ThreadHeader = memo(function ThreadHeader({
  onBack,
  onInfo,
  actions,
}: {
  onBack?: () => void;
  onInfo: () => void;
  actions?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const { conversation } = useThread();
  const typing = useChatThreadStore((state) => state.threads[conversation.id]?.typing ?? NO_TYPING);
  const title = conversationTitle(conversation, t);
  const avatar = conversationAvatar(conversation);
  const muted = isMuted(conversation, Date.now());

  return (
    <header
      data-ui="chat-thread-header"
      className="@container/header relative z-20 h-[58px] shrink-0 border-b border-ink/[0.05]"
    >
      <GlassLayer blur={30} tint={surface(6, 55)} solid={surface(7)} />
      <div
        className="relative flex h-full items-center gap-2 px-2.5"
        style={{ isolation: 'isolate' }}
      >
        {onBack && (
          <button
            type="button"
            aria-label={t('chat.thread.back')}
            onClick={onBack}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-55 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-white @min-[641px]:hidden"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <button
          type="button"
          onClick={onInfo}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl py-1 pr-2 pl-1 text-left transition-colors duration-150 hover:bg-ink/[0.04]"
        >
          {conversation.kind === 'self' ? (
            <SavedMark />
          ) : avatar ? (
            <Avatar src={avatar} size={36} />
          ) : conversation.kind === 'direct' ? (
            <Avatar size={36} />
          ) : (
            <GroupMark />
          )}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold tracking-tight text-ink-92">
                {title}
              </span>
              {muted && <BellOff size={12} className="shrink-0 text-ink-30" />}
            </span>
            <span className="block truncate text-[11.5px] text-ink-40">
              <Subtitle typing={typing} />
            </span>
          </span>
        </button>
        {hasTimer(conversation) && conversation.ttlS !== null && (
          <button
            type="button"
            title={t('chat.thread.timer.title')}
            onClick={(event) => openTimerMenu(event, conversation, t, i18n.language)}
            className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold tabular-nums transition-colors duration-150 hover:brightness-125"
            style={{ background: 'var(--color-accent-glow)', color: 'var(--color-accent-hover)' }}
          >
            <Timer size={13} />
            {ttlShort(conversation.ttlS, t)}
          </button>
        )}
        <button
          type="button"
          aria-label={t('chat.thread.menu.info')}
          onClick={onInfo}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-50 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-white @max-[480px]/header:hidden"
        >
          <Info size={17} />
        </button>
        <button
          type="button"
          aria-label={t('chat.thread.menu.more')}
          onClick={(event) => openThreadMenu(event, conversation, t, i18n.language, onInfo)}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-50 transition-colors duration-150 hover:bg-ink/[0.07] hover:text-white"
        >
          <Ellipsis size={17} />
        </button>
        {actions}
      </div>
    </header>
  );
});
