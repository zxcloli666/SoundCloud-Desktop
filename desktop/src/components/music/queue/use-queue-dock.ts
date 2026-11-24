import { useLayoutEffect, useSyncExternalStore } from 'react';
import { QUEUE_DOCK_WIDTH, queueFitsBeside } from '../../../lib/queue-dock';
import { useChatDockWidth } from '../../chat/shell/useChatDockWidth';
import { sidebarWidth, useSidebarCollapsed } from '../../layout/SidebarChrome';

function subscribeResize(onChange: () => void) {
  window.addEventListener('resize', onChange);
  return () => window.removeEventListener('resize', onChange);
}

export function useQueueDock(open: boolean) {
  const sidebar = sidebarWidth(useSidebarCollapsed());
  const chat = useChatDockWidth();
  const beside = useSyncExternalStore(subscribeResize, () =>
    queueFitsBeside(window.innerWidth, sidebar, chat),
  );
  const width = open && beside ? QUEUE_DOCK_WIDTH : 0;
  const total = chat + width;

  useLayoutEffect(() => {
    document.documentElement.style.setProperty('--right-dock', `${total}px`);
  }, [total]);

  return { beside, width, right: chat };
}
