import { create } from 'zustand';

export const SOUND_SECTIONS = ['main', 'eq', 'effects'] as const;
export type SoundSection = (typeof SOUND_SECTIONS)[number];

export const useSoundWindow = create<{ open: boolean; section: SoundSection }>(() => ({
  open: false,
  section: 'main',
}));

export function openSound(section: SoundSection = 'main') {
  useSoundWindow.setState({ open: true, section });
}

export function closeSound() {
  useSoundWindow.setState({ open: false });
}

export function toggleSection(section: SoundSection) {
  useSoundWindow.setState((s) => ({ section: s.section === section ? 'main' : section }));
}
