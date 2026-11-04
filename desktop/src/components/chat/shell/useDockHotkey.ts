import { useEffect } from 'react';
import { chordFromEvent, toAccelerator } from '../../../lib/hotkeys/accelerator';
import { useChatPrefsStore } from '../../../stores/chat/prefs';

function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export function useDockHotkey() {
  const hotkey = useChatPrefsStore((state) => state.hotkey);

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const chord = chordFromEvent(event);
      if (toAccelerator(chord) !== hotkey) return;
      const strong = chord.modifiers.includes('Control') || chord.modifiers.includes('Super');
      if (isTyping(event.target) && !strong) return;
      event.preventDefault();
      useChatPrefsStore.getState().toggleDock();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hotkey]);
}
