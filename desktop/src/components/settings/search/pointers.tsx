import type { ReactNode } from 'react';
import { AudioLines, Keyboard, Moon, SlidersHorizontal, Waves } from '../../../lib/icons';
import { pressPlayerButton } from '../../../lib/player-trigger';
import type { SettingsResult } from '../../../lib/settings-search/useSettingsSearch';
import { useShortcutsStore } from '../../../stores/shortcuts';
import { showSound } from '../../../stores/sound-window';
import { Mic } from '../../voice/icons';

const SIZE = 18;

export const POINTER_ICONS: Record<string, ReactNode> = {
  'elsewhere.equalizer': <AudioLines size={SIZE} />,
  'elsewhere.effects': <Waves size={SIZE} />,
  'elsewhere.speed': <SlidersHorizontal size={SIZE} />,
  'elsewhere.sleep': <Moon size={SIZE} />,
  'elsewhere.shortcuts': <Keyboard size={SIZE} />,
  'elsewhere.voice': <Mic size={SIZE} />,
};

export function openPointer({ sound, trigger }: SettingsResult) {
  if (sound) showSound(sound);
  else if (trigger) pressPlayerButton(trigger);
  else useShortcutsStore.getState().setOpen(true);
}
