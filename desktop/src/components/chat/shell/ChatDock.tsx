import { memo } from 'react';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { DeviceAlertHost } from '../devices/DeviceAlertHost';
import { DeleteChatDialog } from '../list/DeleteChatDialog';
import { NewChatSheet } from '../new-chat/NewChatSheet';
import { ReportSheet } from '../requests/ReportSheet';
import { SharePickerHost } from '../share/SharePickerHost';
import { ChatToastHost } from '../toasts/ChatToastHost';
import { DockPanel } from './DockPanel';
import { CHAT_KEYFRAMES } from './keyframes';
import { useChatBoot } from './useChatBoot';
import { useDockHotkey } from './useDockHotkey';
import { useDockMode, useRememberOutsidePath } from './useDockMode';
import { useNotifyOpen } from './useNotifyOpen';

function ChatHosts() {
  useDockHotkey();
  useNotifyOpen();
  return (
    <>
      <style>{CHAT_KEYFRAMES}</style>
      <ChatToastHost />
      <NewChatSheet />
      <ReportSheet />
      <DeleteChatDialog />
      <SharePickerHost />
      <DeviceAlertHost />
    </>
  );
}

export const ChatDock = memo(function ChatDock() {
  useChatBoot();
  useRememberOutsidePath();
  const enabled = useChatStore(selectChatEnabled);
  const mode = useDockMode();
  if (!enabled) return null;
  return (
    <>
      {mode !== 'hidden' && <DockPanel mode={mode} />}
      <ChatHosts />
    </>
  );
});
