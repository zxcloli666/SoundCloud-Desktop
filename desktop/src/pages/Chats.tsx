import { memo, type ReactNode, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ConversationList } from '../components/chat/list/ConversationList';
import { ChatGate } from '../components/chat/shell/ChatGate';
import { ChatsGlow } from '../components/chat/shell/ChatsGlow';
import { EmptyThread } from '../components/chat/shell/EmptyThread';
import { RoomTab } from '../components/chat/shell/RoomTab';
import { ThreadSlot } from '../components/chat/shell/ThreadSlot';
import { chatPath } from '../components/chat/shell/useOpenChat';
import { ink, surface } from '../lib/chat/tone';
import { usePerfMode } from '../lib/perf';
import { DOCK_ROOM } from '../stores/chat/prefs';
import { useChatRoomStore } from '../stores/chat/room';

const PANEL =
  'relative flex min-h-0 flex-col overflow-hidden rounded-[1.75rem] border border-ink/[0.08]';

function Panel({ className, children }: { className: string; children: ReactNode }) {
  const blur = usePerfMode().blur(40);
  return (
    <section
      className={`${PANEL} ${className}`}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)' }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          contain: 'strict',
          transform: 'translateZ(0)',
          background:
            blur > 0
              ? `linear-gradient(165deg, ${ink(6)}, ${ink(1.5)} 60%), ${surface(6, 42)}`
              : surface(7, 92),
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
        }}
      />
      <div className="relative flex min-h-0 flex-1 flex-col" style={{ isolation: 'isolate' }}>
        {children}
      </div>
    </section>
  );
}

export const Chats = memo(function Chats() {
  const { id } = useParams();
  const navigate = useNavigate();
  const selected = id ?? null;
  const roomCode = useChatRoomStore((state) => state.code);
  const roomChat = useChatRoomStore((state) => state.conversationId);
  const room = roomCode !== null && (selected === DOCK_ROOM || selected === roomChat);
  const open = (conversationId: string) => navigate(chatPath(conversationId));

  useEffect(() => {
    if (selected === DOCK_ROOM && roomCode === null) navigate('/chats', { replace: true });
  }, [selected, roomCode, navigate]);

  let thread = <EmptyThread />;
  if (room) {
    thread = <RoomTab conversationId={roomChat} onBack={() => navigate('/chats')} />;
  } else if (selected && selected !== DOCK_ROOM) {
    thread = (
      <ThreadSlot
        key={selected}
        conversationId={selected}
        variant="page"
        onBack={() => navigate('/chats')}
      />
    );
  }

  return (
    <div data-ui="chat-page" className="relative h-full w-full">
      <ChatsGlow />
      <div className="@container relative z-10 mx-auto flex h-full max-w-[1480px] px-4 pt-4 md:px-5 md:pt-5">
        <ChatGate>
          <div className="flex h-full min-h-0 w-full gap-4">
            <Panel
              className={`w-full shrink-0 @min-[641px]:w-[clamp(280px,32cqw,380px)] ${
                selected ? '@max-[640px]:hidden' : ''
              }`}
            >
              <ConversationList
                variant="page"
                selectedId={selected}
                roomSelected={room}
                onOpen={open}
                onOpenRoom={() => open(DOCK_ROOM)}
              />
            </Panel>
            <Panel className={`min-w-0 flex-1 ${selected ? '' : '@max-[640px]:hidden'}`}>
              {thread}
            </Panel>
          </div>
        </ChatGate>
      </div>
    </div>
  );
});
