import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConvId, Seq } from '../../../lib/chat/types';
import { useChatStore } from '../../../stores/chat';
import { useChatListStore } from '../../../stores/chat/list';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { ComposerGate } from '../composer/ComposerGate';
import { InfoSheet } from '../info/InfoSheet';
import { ThreadDrop } from '../media/compose/ThreadDrop';
import { TraySpace } from '../media/compose/tray-space';
import { UploadTray } from '../media/UploadTray';
import { useRoomMembers, useRoomModerator } from '../room/useRoom';
import { ThreadContext, type ThreadContextValue } from './context';
import { focusThread } from './focus';
import { HistorySlot } from './HistorySlot';
import { THREAD_KEYFRAMES } from './keyframes';
import { PinnedBar } from './PinnedBar';
import { ThreadDialogs } from './ThreadDialogs';
import { ThreadHeader } from './ThreadHeader';
import { ThreadEmpty, ThreadFailed, ThreadGone, ThreadSkeleton } from './ThreadStates';
import { Timeline, type TimelineHandle } from './Timeline';
import { useBlocked } from './useBlocked';
import { usePeople } from './usePeople';
import { useStableConversation } from './useStableConversation';

export interface ChatThreadProps {
  conversationId: ConvId;
  onBack?: () => void;
  onLeave?: () => void;
  actions?: ReactNode;
  bare?: boolean;
}

export const ChatThread = memo(function ChatThread({
  conversationId,
  onBack,
  onLeave,
  actions,
  bare = false,
}: ChatThreadProps) {
  const opened = useChatThreadStore((state) => state.threads[conversationId]?.conversation ?? null);
  const listed = useChatListStore((state) => state.byId[conversationId]);
  const conversation = useStableConversation(opened ? (listed ?? opened) : null);
  const load = useChatThreadStore((state) => state.threads[conversationId]?.load ?? 'idle');
  const threadMembers = useChatThreadStore((state) => state.threads[conversationId]?.members);
  const roomMembers = useRoomMembers(conversationId);
  const members = roomMembers ?? threadMembers;
  const moderator = useRoomModerator(conversationId);
  const empty = useChatThreadStore(
    (state) => (state.threads[conversationId]?.messages.length ?? 0) === 0,
  );
  const me = useChatStore((state) => state.status?.userId ?? null);
  const { t, i18n } = useTranslation();
  const { people, nameOf } = usePeople(conversation, members, me);
  const shared = conversation?.kind === 'group' || conversation?.kind === 'room';
  const blocked = useBlocked(shared);
  const timeline = useRef<TimelineHandle>(null);
  const [info, setInfo] = useState(false);
  const [traySpace, setTraySpace] = useState(0);
  const leave = useRef(onLeave);
  leave.current = onLeave;

  useEffect(() => {
    if (load === 'gone') leave.current?.();
  }, [load]);

  useEffect(() => {
    const store = useChatThreadStore.getState();
    store.setOpen(conversationId);
    void store.load(conversationId);
    const release = focusThread(conversationId);
    setInfo(false);
    return () => {
      release();
      if (useChatThreadStore.getState().openId === conversationId) {
        useChatThreadStore.getState().setOpen(null);
      }
    };
  }, [conversationId]);

  const jumpTo = useCallback((seq: Seq) => void timeline.current?.jumpTo(seq), []);
  const openInfo = useCallback(() => setInfo(true), []);
  const closeInfo = useCallback(() => setInfo(false), []);
  const jumpFromInfo = useCallback(
    (seq: Seq) => {
      setInfo(false);
      jumpTo(seq);
    },
    [jumpTo],
  );

  const context = useMemo<ThreadContextValue | null>(
    () =>
      conversation
        ? {
            t,
            language: i18n.language,
            conversation,
            me,
            people,
            blocked,
            moderator,
            nameOf,
            jumpTo,
          }
        : null,
    [t, i18n.language, conversation, me, people, blocked, moderator, nameOf, jumpTo],
  );

  if (!context) {
    if (load === 'failed') {
      return (
        <ThreadFailed onRetry={() => void useChatThreadStore.getState().load(conversationId)} />
      );
    }
    if (load === 'gone') return <ThreadGone />;
    return <ThreadSkeleton />;
  }

  return (
    <ThreadContext.Provider value={context}>
      <style>{THREAD_KEYFRAMES}</style>
      <section
        key={conversationId}
        data-ui="chat-thread"
        data-kind={context.conversation.kind}
        className="relative flex h-full min-h-0 flex-col overflow-hidden"
      >
        {!bare && <ThreadHeader onBack={onBack} onInfo={openInfo} actions={actions} />}
        <PinnedBar />
        <HistorySlot />
        <TraySpace.Provider value={traySpace}>
          {empty && load === 'ready' ? (
            <ThreadEmpty saved={context.conversation.kind === 'self'} />
          ) : (
            <Timeline ref={timeline} conversationId={conversationId} />
          )}
        </TraySpace.Provider>
        <UploadTray conversationId={conversationId} onSpace={setTraySpace} />
        <ComposerGate conversationId={conversationId} />
        {info && <InfoSheet onClose={closeInfo} onJump={jumpFromInfo} />}
        <ThreadDialogs conversationId={conversationId} />
        <ThreadDrop conversation={context.conversation} />
      </section>
    </ThreadContext.Provider>
  );
});
