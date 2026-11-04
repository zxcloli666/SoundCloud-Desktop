import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle, MessagesSquare } from '../../../lib/chat/icons';
import type { ConvId } from '../../../lib/chat/types';
import { Radio, X } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useChatStore } from '../../../stores/chat';
import { useChatListStore } from '../../../stores/chat/list';
import { DOCK_LIST, DOCK_ROOM, useChatPrefsStore } from '../../../stores/chat/prefs';
import { useChatRoomStore } from '../../../stores/chat/room';
import { ConversationAvatar } from '../list/ConversationAvatar';
import { conversationAvatar, conversationTitle } from '../list/conversation-meta';
import { useRoomLabel } from '../list/RoomRow';

const ACTIVE_RING = {
  boxShadow: '0 0 0 2px var(--color-accent), 0 0 18px var(--color-accent-glow)',
};

function Dot() {
  return (
    <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-chat-cutout bg-[var(--color-accent)]" />
  );
}

function Puck({
  active,
  label,
  dot,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  dot: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-[1.06] active:scale-[0.95] ${
        active ? 'bg-ink/[0.1] text-ink' : 'bg-ink/[0.04] text-ink-55 hover:text-ink-85'
      }`}
      style={active ? ACTIVE_RING : undefined}
    >
      {children}
      {dot && !active && <Dot />}
    </button>
  );
}

const ChatTab = memo(function ChatTab({ id, active }: { id: ConvId; active: boolean }) {
  const { t } = useTranslation();
  const conversation = useChatListStore((state) => state.byId[id]);
  const show = useChatPrefsStore((state) => state.show);
  const closeTab = useChatPrefsStore((state) => state.closeTab);
  const title = conversation ? conversationTitle(conversation, t) : t('chat.list.unknown');

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={active}
        onClick={() => show(id)}
        onAuxClick={(event) => event.button === 1 && closeTab(id)}
        className="relative flex size-9 cursor-pointer items-center justify-center rounded-full transition-transform duration-200 hover:scale-[1.06] active:scale-[0.95]"
        style={active ? ACTIVE_RING : undefined}
      >
        {conversation ? (
          <ConversationAvatar
            kind={conversation.kind}
            src={conversationAvatar(conversation)}
            name={title}
            size={34}
          />
        ) : (
          <span className="flex size-[34px] items-center justify-center rounded-full bg-ink/[0.06] text-ink-40">
            <MessageCircle size={15} />
          </span>
        )}
        {conversation && conversation.unread > 0 && !active && <Dot />}
      </button>
      <button
        type="button"
        aria-label={t('chat.list.dock.closeTab')}
        onClick={() => closeTab(id)}
        className="absolute -top-1 -left-1 hidden size-4 cursor-pointer items-center justify-center rounded-full bg-paper text-ink-75 ring-1 ring-ink/[0.12] group-hover:flex hover:text-ink"
      >
        <X size={9} strokeWidth={3} />
      </button>
    </div>
  );
});

export const DockTabs = memo(function DockTabs() {
  const { t } = useTranslation();
  const animate = usePerfMode().idleAnim;
  const tabs = useChatPrefsStore((state) => state.tabs);
  const active = useChatPrefsStore((state) => state.active);
  const show = useChatPrefsStore((state) => state.show);
  const setDockOpen = useChatPrefsStore((state) => state.setDockOpen);
  const roomCode = useChatRoomStore((state) => state.code);
  const roomLabel = useRoomLabel();
  const roomChat = useChatRoomStore((state) => state.conversationId);
  const roomUnread = useChatListStore(
    (state) => roomChat !== null && (state.byId[roomChat]?.unread ?? 0) > 0,
  );
  const unread = useChatStore((state) => state.status?.unread ?? 0);
  const requests = useChatListStore((state) => state.requests);

  return (
    <div data-ui="chat-dock-tabs" className="flex h-14 shrink-0 items-center gap-2 px-3">
      <Puck
        active={active === DOCK_LIST}
        label={t('chat.list.dock.list')}
        dot={unread > 0 || requests > 0}
        onClick={() => show(DOCK_LIST)}
      >
        <MessagesSquare size={16} />
      </Puck>
      {roomCode && (
        <Puck
          active={active === DOCK_ROOM}
          label={roomLabel}
          dot={roomUnread}
          onClick={() => show(DOCK_ROOM)}
        >
          {animate && (
            <span
              aria-hidden
              className="chat-motion absolute inset-0 rounded-full border border-[var(--color-accent)]"
              style={{ animation: 'chat-live 1.8s ease-out infinite' }}
            />
          )}
          <Radio size={16} className="text-[var(--color-accent)]" />
        </Puck>
      )}
      {tabs.length > 0 && <span className="h-5 w-px shrink-0 bg-ink/[0.08]" />}
      {tabs.map((id) => (
        <ChatTab key={id} id={id} active={active === id} />
      ))}
      <span className="flex-1" />
      <button
        type="button"
        title={t('chat.list.dock.close')}
        aria-label={t('chat.list.dock.close')}
        onClick={() => setDockOpen(false)}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-45 transition-colors hover:bg-ink/[0.08] hover:text-ink-90"
      >
        <X size={15} />
      </button>
    </div>
  );
});
