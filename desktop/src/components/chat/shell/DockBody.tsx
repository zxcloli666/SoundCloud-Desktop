import { memo, useState } from 'react';
import { useChatStore } from '../../../stores/chat';
import { holdsLocalStore } from '../../../stores/chat/account';
import { DOCK_LIST, DOCK_ROOM, useChatPrefsStore } from '../../../stores/chat/prefs';
import { useChatRoomStore } from '../../../stores/chat/room';
import { ConversationList } from '../list/ConversationList';
import { TraySpace } from '../media/compose/tray-space';
import { UploadTray } from '../media/UploadTray';
import { ChatGate } from './ChatGate';
import { RoomTab } from './RoomTab';
import { ThreadSlot } from './ThreadSlot';

function DockList() {
  const openInDock = useChatPrefsStore((state) => state.openInDock);
  const show = useChatPrefsStore((state) => state.show);
  return (
    <ConversationList
      variant="dock"
      selectedId={null}
      onOpen={openInDock}
      onOpenRoom={() => show(DOCK_ROOM)}
    />
  );
}

export const DockBody = memo(function DockBody() {
  const active = useChatPrefsStore((state) => state.active);
  const tabs = useChatPrefsStore((state) => state.tabs);
  const roomCode = useChatRoomStore((state) => state.code);
  const roomChat = useChatRoomStore((state) => state.conversationId);
  const local = useChatStore((state) => holdsLocalStore(state.status?.phase ?? null));
  const [traySpace, setTraySpace] = useState(0);

  let content = <DockList />;
  let thread = false;
  if (active === DOCK_ROOM && roomCode) {
    content = <RoomTab conversationId={roomChat} />;
    thread = true;
  } else if (active !== DOCK_LIST && active !== DOCK_ROOM && tabs.includes(active)) {
    content = <ThreadSlot key={active} conversationId={active} variant="dock" />;
    thread = true;
  }

  return (
    <div className="relative min-h-0 flex-1">
      <TraySpace.Provider value={local ? traySpace : 0}>
        <ChatGate>{content}</ChatGate>
      </TraySpace.Provider>
      {!thread && local && <UploadTray onSpace={setTraySpace} />}
    </div>
  );
});
