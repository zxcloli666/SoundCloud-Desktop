import { useChatPrefsStore } from '../../../stores/chat/prefs';
import { useDockMode } from './useDockMode';

export function useChatDockWidth(): number {
  const mode = useDockMode();
  const width = useChatPrefsStore((state) => state.dockWidth);
  return mode === 'docked' ? width : 0;
}
