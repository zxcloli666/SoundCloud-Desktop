import { create } from 'zustand';

export type LyricsPanelTab = 'lyrics' | 'comments';

interface OpenLyricsPanelOptions {
  tab?: LyricsPanelTab;
  rightPanelOpen?: boolean;
}

interface LyricsUIState {
  open: boolean;
  tab: LyricsPanelTab;
  rightPanelOpen: boolean;
  toggle: () => void;
  openPanel: (options?: OpenLyricsPanelOptions | LyricsPanelTab) => void;
  setTab: (tab: LyricsPanelTab) => void;
  setRightPanelOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  close: () => void;
}

export const useLyricsStore = create<LyricsUIState>()((set) => ({
  open: false,
  tab: 'lyrics',
  rightPanelOpen: true,
  toggle: () => set((s) => ({ open: !s.open })),
  openPanel: (options) =>
    set((s) => {
      const normalized = typeof options === 'string' ? { tab: options } : (options ?? {});

      return {
        open: true,
        tab: normalized.tab ?? s.tab,
        rightPanelOpen: normalized.rightPanelOpen ?? s.rightPanelOpen,
      };
    }),
  setTab: (tab) => set({ tab }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  close: () => set({ open: false }),
}));
