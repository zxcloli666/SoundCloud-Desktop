import { useEffect, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { selectChatEnabled, useChatStore } from '../../../stores/chat';
import { CHAT_DOCK_OVERLAY_BELOW, useChatPrefsStore } from '../../../stores/chat/prefs';

export type DockMode = 'hidden' | 'docked' | 'overlay';

const CHATS_PATH = /^\/chats(\/|$)/;

let outsidePath = '/home';

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

function readWide() {
  return window.innerWidth >= CHAT_DOCK_OVERLAY_BELOW;
}

export function lastOutsidePath(): string {
  return outsidePath;
}

export function useOnChatsPage(): boolean {
  return CHATS_PATH.test(useLocation().pathname);
}

export function useRememberOutsidePath() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!CHATS_PATH.test(pathname)) outsidePath = `${pathname}${search}`;
  }, [pathname, search]);
}

export function useDockMode(): DockMode {
  const enabled = useChatStore(selectChatEnabled);
  const open = useChatPrefsStore((state) => state.dockOpen);
  const onPage = useOnChatsPage();
  const wide = useSyncExternalStore(subscribeResize, readWide);
  if (!enabled || !open || onPage) return 'hidden';
  return wide ? 'docked' : 'overlay';
}
