import { useEffect } from 'react';
import { useSearchPrefsStore } from '../../stores/searchPrefs';
import { isTyping } from '../moments/use-stage-gestures';

export function useViewHotkey(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'KeyM' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      useSearchPrefsStore.getState().toggleView();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
