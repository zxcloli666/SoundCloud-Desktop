import { create } from 'zustand';
import { chatBridge } from '../../lib/chat/bridge';
import { onChatEvent } from '../../lib/chat/events';
import type { ChatConfig, ChatStatus } from '../../lib/chat/types';
import { accountChange, holdsLocalStore } from './account';
import { useBackdropStore } from './backdrop';
import { useChatDevicesStore } from './devices';
import { useChatListStore } from './list';
import { useChatMediaStore } from './media';
import { useChatThreadStore } from './thread';

export interface ChatState {
  status: ChatStatus | null;
  config: ChatConfig | null;
  setStatus: (status: ChatStatus) => void;
  setConfig: (config: ChatConfig | null) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  status: null,
  config: null,
  setStatus: (status) => set({ status }),
  setConfig: (config) => set({ config }),
}));

export const selectChatEnabled = (state: ChatState) =>
  state.config?.enabled === true && state.status !== null && state.status.phase !== 'off';

let accountTurn = 0;

function accountSwitched() {
  useChatMediaStore.getState().reset();
  useBackdropStore.getState().forgetUploads();
  const { config, setConfig } = useChatStore.getState();
  if (config?.media) setConfig({ ...config, media: undefined });
  refreshAccount();
}

function refreshAccount() {
  const turn = ++accountTurn;
  void chatBridge
    .config()
    .then((next) => {
      if (turn === accountTurn) useChatStore.getState().setConfig(next);
    })
    .catch(() => undefined);
  refreshUploads();
}

function refreshUploads() {
  void useChatMediaStore
    .getState()
    .refreshUploads()
    .catch(() => undefined);
}

export async function initChatBridge(): Promise<() => void> {
  const stops = await Promise.all([
    onChatEvent('chat:status', (status) => {
      const before = useChatStore.getState().status;
      useChatStore.getState().setStatus(status);
      const change = accountChange(before, status);
      if (change === 'switched') accountSwitched();
      else if (change === 'arrived') refreshAccount();
      else if (status.phase === 'ready' && before?.phase !== 'ready') refreshUploads();
      if (!holdsLocalStore(status.phase) && useChatMediaStore.getState().local) {
        useChatMediaStore.setState({ local: false });
      }
    }),
    onChatEvent('chat:sync', (event) => {
      useChatListStore.getState().applySync(event);
      useChatThreadStore.getState().applyMarks(event.marks);
    }),
    onChatEvent('chat:messages', (event) => useChatThreadStore.getState().applyMessages(event)),
    onChatEvent('chat:typing', (event) => useChatThreadStore.getState().applyTyping(event)),
    onChatEvent('chat:gone', (event) => {
      useChatListStore.getState().applyGone(event);
      useChatThreadStore.getState().applyGone(event);
    }),
    onChatEvent('chat:media-uploads', (event) => useChatMediaStore.getState().applyUploads(event)),
    onChatEvent('chat:media-upload-error', (event) =>
      useChatMediaStore.getState().applyError(event),
    ),
    onChatEvent('chat:media-state', (event) =>
      useChatMediaStore.getState().setShown(event.mediaId, event.state, event.retryInMs),
    ),
    onChatEvent('chat:device-added', ({ device }) =>
      useChatDevicesStore.getState().pushAlert(device),
    ),
  ]);
  const [status, config] = await Promise.allSettled([chatBridge.status(), chatBridge.config()]);
  if (status.status === 'fulfilled') useChatStore.getState().setStatus(status.value);
  useChatStore.getState().setConfig(config.status === 'fulfilled' ? config.value : null);
  refreshUploads();
  return () => {
    for (const stop of stops) stop();
  };
}
