import type { ReactNode } from 'react';
import { AudioLines, Keyboard, SlidersHorizontal, Waves } from '../../../lib/icons';
import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { useShortcutsStore } from '../../../stores/shortcuts';
import { Mic } from '../../voice/icons';

const SIZE = 18;

export const POINTER_ICONS: Record<string, ReactNode> = {
  'elsewhere.equalizer': <AudioLines size={SIZE} />,
  'elsewhere.effects': <Waves size={SIZE} />,
  'elsewhere.speed': <SlidersHorizontal size={SIZE} />,
  'elsewhere.shortcuts': <Keyboard size={SIZE} />,
  'elsewhere.voice': <Mic size={SIZE} />,
};

export function openPointer(result: SettingsResult) {
  if (!result.trigger) {
    useShortcutsStore.getState().setOpen(true);
    return;
  }
  const button = document.querySelector<HTMLElement>(`[data-ui="${result.trigger}"]`);
  if (button && button.getClientRects().length > 0) button.click();
}
