import { useEffect } from 'react';
import { chatBridge } from '../../../lib/chat/bridge';
import { watchChatRelogin } from '../../../lib/chat/login';
import { queryClient } from '../../../lib/query-client';
import { initChatBridge, useChatStore } from '../../../stores/chat';
import { useChatListStore } from '../../../stores/chat/list';
import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { useChatThreadStore } from '../../../stores/chat/thread';
import { useChatToastStore } from '../toasts/toast-store';

function refetchConfig() {
  if (useChatStore.getState().config !== null) return;
  chatBridge
    .config()
    .then((config) => useChatStore.getState().setConfig(config))
    .catch(() => undefined);
}

function forgetAccount() {
  useChatListStore.getState().clear();
  useChatThreadStore.getState().clear();
  useChatToastStore.getState().clear();
  queryClient.removeQueries({ queryKey: ['chat'] });
}

function claimDock() {
  const userId = useChatStore.getState().status?.userId;
  if (userId && useChatPrefsStore.persist.hasHydrated()) {
    useChatPrefsStore.getState().claim(userId);
  }
}

export function useChatBoot() {
  useEffect(() => {
    let stopped = false;
    let stop: (() => void) | null = null;
    void initChatBridge()
      .then((unlisten) => {
        if (stopped) unlisten();
        else stop = unlisten;
      })
      .catch(() => undefined);
    const stopRelogin = watchChatRelogin();
    const stopHydration = useChatPrefsStore.persist.onFinishHydration(claimDock);
    const unsubscribe = useChatStore.subscribe((state, prev) => {
      const status = state.status;
      const userId = status?.userId ?? null;
      const prevUserId = prev.status?.userId ?? null;
      if (prevUserId !== null && userId !== prevUserId) forgetAccount();
      if (userId !== prevUserId) claimDock();
      if (status && status.requests !== prev.status?.requests) {
        useChatListStore.getState().setRequests(status.requests);
      }
      const phase = status?.phase;
      if (phase === prev.status?.phase) return;
      if (state.config === null && phase && phase !== 'off') queueMicrotask(refetchConfig);
      if (phase === 'ready') void useChatListStore.getState().refresh();
    });
    return () => {
      stopped = true;
      stop?.();
      stopRelogin();
      stopHydration();
      unsubscribe();
    };
  }, []);
}
