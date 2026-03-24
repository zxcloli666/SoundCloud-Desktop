import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { tauriStorage } from '../lib/tauri-storage';

export type ThemePreset = 'soundcloud' | 'dark' | 'neon' | 'forest' | 'crimson' | 'custom';
export type StartupPage = 'home' | 'search' | 'library' | 'settings';
export type DiscordRpcMode = 'track' | 'artist' | 'activity';
export interface SidebarPinnedPlaylist {
  urn: string;
  title: string;
  artworkUrl: string | null;
}

export interface ThemePresetDef {
  accent: string;
  bg: string;
  name: string;
  /** [accent, bg, card] for preview swatch */
  preview: [string, string, string];
}

export const THEME_PRESETS: Record<Exclude<ThemePreset, 'custom'>, ThemePresetDef> = {
  soundcloud: {
    accent: '#ff5500',
    bg: '#08080a',
    name: 'SoundCloud',
    preview: ['#ff5500', '#08080a', '#1a1a1e'],
  },
  dark: {
    accent: '#ffffff',
    bg: '#000000',
    name: 'Тьма',
    preview: ['#ffffff', '#000000', '#111111'],
  },
  neon: {
    accent: '#bf5af2',
    bg: '#08060f',
    name: 'Неон',
    preview: ['#bf5af2', '#08060f', '#18102a'],
  },
  forest: {
    accent: '#22c55e',
    bg: '#050e08',
    name: 'Лес',
    preview: ['#22c55e', '#050e08', '#0a1f10'],
  },
  crimson: {
    accent: '#ff2d55',
    bg: '#0c0507',
    name: 'Кармин',
    preview: ['#ff2d55', '#0c0507', '#1e0a10'],
  },
};

export interface SettingsState {
  accentColor: string;
  bgPrimary: string;
  themePreset: ThemePreset;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  glassBlur: number;
  audioCacheLimitMB: number;
  language: string;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  normalizeVolume: boolean;
  sidebarCollapsed: boolean;
  floatingComments: boolean;
  startupPage: StartupPage;
  pinnedPlaylists: SidebarPinnedPlaylist[];
  discordRpcEnabled: boolean;
  discordRpcMode: DiscordRpcMode;
  discordRpcShowButton: boolean;
  setAccentColor: (color: string) => void;
  setBgPrimary: (bg: string) => void;
  setThemePreset: (id: ThemePreset) => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setBackgroundBlur: (blur: number) => void;
  setGlassBlur: (blur: number) => void;
  setAudioCacheLimitMB: (limit: number) => void;
  setLanguage: (lang: string) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqGains: (gains: number[]) => void;
  setEqPreset: (preset: string) => void;
  setEqBand: (index: number, gain: number) => void;
  setNormalizeVolume: (enabled: boolean) => void;
  toggleSidebar: () => void;
  setFloatingComments: (v: boolean) => void;
  setStartupPage: (page: StartupPage) => void;
  pinPlaylist: (playlist: SidebarPinnedPlaylist) => void;
  unpinPlaylist: (urn: string) => void;
  setDiscordRpcEnabled: (enabled: boolean) => void;
  setDiscordRpcMode: (mode: DiscordRpcMode) => void;
  setDiscordRpcShowButton: (show: boolean) => void;
  resetTheme: () => void;
}

const DEFAULT_EQ_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const DEFAULTS = {
  accentColor: '#ff5500',
  bgPrimary: '#08080a',
  themePreset: 'soundcloud' as ThemePreset,
  backgroundImage: '',
  backgroundOpacity: 0.15,
  backgroundBlur: 0,
  glassBlur: 40,
  audioCacheLimitMB: 1024,
  language: navigator.language?.split('-')[0] || 'en',
  eqEnabled: false,
  eqGains: DEFAULT_EQ_GAINS,
  eqPreset: 'flat',
  normalizeVolume: true,
  sidebarCollapsed: false,
  floatingComments: true,
  startupPage: 'home' as StartupPage,
  pinnedPlaylists: [] as SidebarPinnedPlaylist[],
  discordRpcEnabled: true,
  discordRpcMode: 'track' as DiscordRpcMode,
  discordRpcShowButton: true,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setAccentColor: (accentColor) => set({ accentColor, themePreset: 'custom' }),
      setBgPrimary: (bgPrimary) => set({ bgPrimary, themePreset: 'custom' }),
      setThemePreset: (id) => {
        if (id === 'custom') {
          set({ themePreset: 'custom' });
        } else {
          const preset = THEME_PRESETS[id];
          set({ themePreset: id, accentColor: preset.accent, bgPrimary: preset.bg });
        }
      },
      setBackgroundImage: (backgroundImage) => set({ backgroundImage }),
      setBackgroundOpacity: (backgroundOpacity) => set({ backgroundOpacity }),
      setBackgroundBlur: (backgroundBlur) => set({ backgroundBlur }),
      setGlassBlur: (glassBlur) => set({ glassBlur }),
      setAudioCacheLimitMB: (audioCacheLimitMB) => set({ audioCacheLimitMB }),
      setLanguage: (language) => set({ language }),
      setEqEnabled: (eqEnabled) => set({ eqEnabled }),
      setEqGains: (eqGains) => set({ eqGains, eqPreset: 'custom' }),
      setEqPreset: (eqPreset) => set({ eqPreset }),
      setEqBand: (index, gain) =>
        set((s) => {
          const eqGains = [...s.eqGains];
          eqGains[index] = gain;
          return { eqGains, eqPreset: 'custom' };
        }),
      setNormalizeVolume: (normalizeVolume) => set({ normalizeVolume }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setFloatingComments: (floatingComments) => set({ floatingComments }),
      setStartupPage: (startupPage) => set({ startupPage }),
      pinPlaylist: (playlist) =>
        set((s) => ({
          pinnedPlaylists: [
            playlist,
            ...s.pinnedPlaylists.filter((item) => item.urn !== playlist.urn),
          ].slice(0, 8),
        })),
      unpinPlaylist: (urn) =>
        set((s) => ({
          pinnedPlaylists: s.pinnedPlaylists.filter((item) => item.urn !== urn),
        })),
      setDiscordRpcEnabled: (discordRpcEnabled) => set({ discordRpcEnabled }),
      setDiscordRpcMode: (discordRpcMode) => set({ discordRpcMode }),
      setDiscordRpcShowButton: (discordRpcShowButton) => set({ discordRpcShowButton }),
      resetTheme: () =>
        set({
          accentColor: DEFAULTS.accentColor,
          bgPrimary: DEFAULTS.bgPrimary,
          themePreset: DEFAULTS.themePreset,
          backgroundImage: DEFAULTS.backgroundImage,
          backgroundOpacity: DEFAULTS.backgroundOpacity,
          backgroundBlur: DEFAULTS.backgroundBlur,
          glassBlur: DEFAULTS.glassBlur,
        }),
    }),
    {
      name: 'sc-settings',
      storage: createJSONStorage(() => tauriStorage),
      version: 8,
      migrate: (persistedState) =>
        ({
          ...DEFAULTS,
          ...(persistedState as Partial<SettingsState>),
        }) as SettingsState,
      partialize: (s) => ({
        accentColor: s.accentColor,
        bgPrimary: s.bgPrimary,
        themePreset: s.themePreset,
        backgroundImage: s.backgroundImage,
        backgroundOpacity: s.backgroundOpacity,
        backgroundBlur: s.backgroundBlur,
        glassBlur: s.glassBlur,
        audioCacheLimitMB: s.audioCacheLimitMB,
        language: s.language,
        eqEnabled: s.eqEnabled,
        eqGains: s.eqGains,
        eqPreset: s.eqPreset,
        normalizeVolume: s.normalizeVolume,
        sidebarCollapsed: s.sidebarCollapsed,
        floatingComments: s.floatingComments,
        startupPage: s.startupPage,
        pinnedPlaylists: s.pinnedPlaylists,
        discordRpcEnabled: s.discordRpcEnabled,
        discordRpcMode: s.discordRpcMode,
        discordRpcShowButton: s.discordRpcShowButton,
      }),
    },
  ),
);
