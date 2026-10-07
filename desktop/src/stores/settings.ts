import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {InterfaceFont} from '../lib/interface-font';
import {EMPTY_LAYOUT, type LayoutEntry, type LayoutScope, type LayoutState, type RiverSectionId,} from '../lib/layout';
import type {PerfMode} from '../lib/perf';
import {tauriStorage} from '../lib/tauri-storage';

export type ThemePreset = 'soundcloud' | 'dark' | 'neon' | 'forest' | 'crimson' | 'custom';
export type StartupPage = 'home' | 'search' | 'library' | 'settings';
export type DiscordRpcMode = 'track' | 'artist' | 'activity';
export type LyricsHighlight = 'word' | 'line';
export type WallpaperRotationOrder = 'sequence' | 'shuffle';
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
  perfMode: PerfMode;
  perfModeUserSet: boolean;
  perfProbed: boolean;
  backgroundImage: string;
  backgroundOpacity: number;
  backgroundDim: number;
  backgroundBlur: number;
  wallpaperRotation: boolean;
  wallpaperRotationNames: string[];
  wallpaperRotationMinutes: number;
  wallpaperRotationOrder: WallpaperRotationOrder;
  glassBlur: number;
  audioCacheLimitMB: number;
  hoverPreload: boolean;
  language: string;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  normalizeVolume: boolean;
  highQualityStreaming: boolean;
  bypassWhitelist: boolean;
  sidebarCollapsed: boolean;
  floatingComments: boolean;
  startupPage: StartupPage;
  pinnedPlaylists: SidebarPinnedPlaylist[];
  discordRpcEnabled: boolean;
  discordRpcMode: DiscordRpcMode;
  discordRpcShowButton: boolean;
  soundwaveLanguages: string[];
  soundwaveMode: 'similar' | 'diverse';
  soundwaveHideLiked: boolean;
  soundwaveHideListened: boolean;
  lyricsVisualizer: boolean;
  lyricsHighlight: LyricsHighlight;
  artistWaveCollapsed: boolean;
  wallhavenApiKey: string;
  showErrorToasts: boolean;
  interfaceFont: InterfaceFont;
  customFontName: string;
  coverTint: boolean;
  coverAccent: boolean;
  customCss: string;
  customCssEnabled: boolean;
  layouts: LayoutState;
  riverHidden: RiverSectionId[];
  setAccentColor: (color: string) => void;
  setBgPrimary: (bg: string) => void;
  setThemePreset: (id: ThemePreset) => void;
  setPerfMode: (mode: PerfMode) => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setBackgroundDim: (dim: number) => void;
  setBackgroundBlur: (blur: number) => void;
  setWallpaperRotation: (v: boolean) => void;
  setWallpaperRotationNames: (names: string[]) => void;
  setWallpaperRotationMinutes: (minutes: number) => void;
  setWallpaperRotationOrder: (order: WallpaperRotationOrder) => void;
  setGlassBlur: (blur: number) => void;
  setAudioCacheLimitMB: (limit: number) => void;
  setHoverPreload: (enabled: boolean) => void;
  setLanguage: (lang: string) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqGains: (gains: number[]) => void;
  setEqPreset: (preset: string) => void;
  setEqBand: (index: number, gain: number) => void;
  setNormalizeVolume: (enabled: boolean) => void;
  setHighQualityStreaming: (enabled: boolean) => void;
  setBypassWhitelist: (enabled: boolean) => void;
  toggleSidebar: () => void;
  setFloatingComments: (v: boolean) => void;
  setStartupPage: (page: StartupPage) => void;
  pinPlaylist: (playlist: SidebarPinnedPlaylist) => void;
  unpinPlaylist: (urn: string) => void;
  reorderPinnedPlaylists: (urns: string[]) => void;
  setDiscordRpcEnabled: (enabled: boolean) => void;
  setDiscordRpcMode: (mode: DiscordRpcMode) => void;
  setDiscordRpcShowButton: (show: boolean) => void;
  setSoundwaveLanguages: (langs: string[]) => void;
  setSoundwaveMode: (mode: 'similar' | 'diverse') => void;
  setSoundwaveHideLiked: (v: boolean) => void;
  setSoundwaveHideListened: (v: boolean) => void;
  setLyricsVisualizer: (v: boolean) => void;
  setLyricsHighlight: (v: LyricsHighlight) => void;
  setArtistWaveCollapsed: (v: boolean) => void;
  setWallhavenApiKey: (key: string) => void;
  setShowErrorToasts: (v: boolean) => void;
  setInterfaceFont: (font: InterfaceFont) => void;
  setCustomFontName: (name: string) => void;
  setCoverTint: (v: boolean) => void;
  setCoverAccent: (v: boolean) => void;
  setCustomCss: (css: string) => void;
  setCustomCssEnabled: (v: boolean) => void;
  setLayout: (scope: LayoutScope, entries: LayoutEntry[]) => void;
  resetLayout: (scope: LayoutScope) => void;
  setRiverHidden: (ids: RiverSectionId[]) => void;
  resetTheme: () => void;
}

const DEFAULT_EQ_GAINS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const DEFAULTS = {
  accentColor: '#ff5500',
  bgPrimary: '#08080a',
  themePreset: 'soundcloud' as ThemePreset,
  perfMode: 'beauty' as PerfMode,
  perfModeUserSet: false,
  perfProbed: false,
  backgroundImage: '',
  backgroundOpacity: 0.15,
  backgroundDim: 0,
  backgroundBlur: 0,
  wallpaperRotation: false,
  wallpaperRotationNames: [] as string[],
  wallpaperRotationMinutes: 15,
  wallpaperRotationOrder: 'sequence' as WallpaperRotationOrder,
  glassBlur: 40,
  audioCacheLimitMB: 1024,
  hoverPreload: true,
  language: navigator.language?.split('-')[0] || 'en',
  eqEnabled: false,
  eqGains: DEFAULT_EQ_GAINS,
  eqPreset: 'flat',
  normalizeVolume: true,
  highQualityStreaming: false,
  bypassWhitelist: false,
  sidebarCollapsed: false,
  floatingComments: true,
  startupPage: 'home' as StartupPage,
  pinnedPlaylists: [] as SidebarPinnedPlaylist[],
  discordRpcEnabled: true,
  discordRpcMode: 'track' as DiscordRpcMode,
  discordRpcShowButton: true,
  soundwaveLanguages: [] as string[],
  soundwaveMode: 'similar' as 'similar' | 'diverse',
  soundwaveHideLiked: false,
  soundwaveHideListened: true,
  lyricsVisualizer: false,
  lyricsHighlight: 'word' as LyricsHighlight,
  artistWaveCollapsed: false,
  wallhavenApiKey: '',
  showErrorToasts: true,
  interfaceFont: 'inter' as InterfaceFont,
  customFontName: '',
  coverTint: false,
  coverAccent: false,
  customCss: '',
  customCssEnabled: true,
  layouts: EMPTY_LAYOUT,
  riverHidden: [] as RiverSectionId[],
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
      setPerfMode: (perfMode) => set({ perfMode, perfModeUserSet: true }),
      setBackgroundImage: (backgroundImage) => set({ backgroundImage }),
      setBackgroundOpacity: (backgroundOpacity) => set({ backgroundOpacity }),
      setBackgroundDim: (backgroundDim) => set({ backgroundDim }),
      setBackgroundBlur: (backgroundBlur) => set({ backgroundBlur }),
      setWallpaperRotation: (wallpaperRotation) => set({ wallpaperRotation }),
      setWallpaperRotationNames: (wallpaperRotationNames) => set({ wallpaperRotationNames }),
      setWallpaperRotationMinutes: (wallpaperRotationMinutes) => set({ wallpaperRotationMinutes }),
      setWallpaperRotationOrder: (wallpaperRotationOrder) => set({ wallpaperRotationOrder }),
      setGlassBlur: (glassBlur) => set({ glassBlur }),
      setAudioCacheLimitMB: (audioCacheLimitMB) => set({ audioCacheLimitMB }),
      setHoverPreload: (hoverPreload) => set({ hoverPreload }),
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
      setHighQualityStreaming: (highQualityStreaming) => set({ highQualityStreaming }),
      setBypassWhitelist: (bypassWhitelist) => set({ bypassWhitelist }),
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
      reorderPinnedPlaylists: (urns) =>
        set((s) => {
          const byUrn = new Map(s.pinnedPlaylists.map((p) => [p.urn, p]));
          const ordered = urns.flatMap((urn) => byUrn.get(urn) ?? []);
          const rest = s.pinnedPlaylists.filter((p) => !urns.includes(p.urn));
          return { pinnedPlaylists: [...ordered, ...rest] };
        }),
      setDiscordRpcEnabled: (discordRpcEnabled) => set({ discordRpcEnabled }),
      setDiscordRpcMode: (discordRpcMode) => set({ discordRpcMode }),
      setDiscordRpcShowButton: (discordRpcShowButton) => set({ discordRpcShowButton }),
      setSoundwaveLanguages: (soundwaveLanguages) => set({ soundwaveLanguages }),
      setSoundwaveMode: (soundwaveMode) => set({ soundwaveMode }),
      setSoundwaveHideLiked: (soundwaveHideLiked) => set({ soundwaveHideLiked }),
      setSoundwaveHideListened: (soundwaveHideListened) => set({ soundwaveHideListened }),
      setLyricsVisualizer: (lyricsVisualizer) => set({ lyricsVisualizer }),
      setLyricsHighlight: (lyricsHighlight) => set({ lyricsHighlight }),
      setArtistWaveCollapsed: (artistWaveCollapsed) => set({ artistWaveCollapsed }),
      setWallhavenApiKey: (wallhavenApiKey) => set({ wallhavenApiKey }),
      setShowErrorToasts: (showErrorToasts) => set({ showErrorToasts }),
      setInterfaceFont: (interfaceFont) => set({ interfaceFont }),
      setCustomFontName: (customFontName) => set({ customFontName }),
      setCoverTint: (coverTint) => set({ coverTint }),
      setCoverAccent: (coverAccent) => set({ coverAccent }),
      setCustomCss: (customCss) => set({ customCss }),
      setCustomCssEnabled: (customCssEnabled) => set({ customCssEnabled }),
      setLayout: (scope, entries) =>
        set((s) => ({ layouts: { ...EMPTY_LAYOUT, ...s.layouts, [scope]: entries } })),
      resetLayout: (scope) =>
        set((s) => ({
          layouts: { ...EMPTY_LAYOUT, ...s.layouts, [scope]: [] },
          riverHidden: scope === 'home' ? [] : s.riverHidden,
        })),
      setRiverHidden: (riverHidden) => set({ riverHidden }),
      resetTheme: () =>
        set({
          accentColor: DEFAULTS.accentColor,
          bgPrimary: DEFAULTS.bgPrimary,
          themePreset: DEFAULTS.themePreset,
          backgroundImage: DEFAULTS.backgroundImage,
          backgroundOpacity: DEFAULTS.backgroundOpacity,
          backgroundDim: DEFAULTS.backgroundDim,
          backgroundBlur: DEFAULTS.backgroundBlur,
          wallpaperRotation: DEFAULTS.wallpaperRotation,
          wallpaperRotationNames: DEFAULTS.wallpaperRotationNames,
          wallpaperRotationMinutes: DEFAULTS.wallpaperRotationMinutes,
          wallpaperRotationOrder: DEFAULTS.wallpaperRotationOrder,
          glassBlur: DEFAULTS.glassBlur,
          interfaceFont: DEFAULTS.interfaceFont,
          customFontName: DEFAULTS.customFontName,
          coverTint: DEFAULTS.coverTint,
          coverAccent: DEFAULTS.coverAccent,
        }),
    }),
    {
      name: 'sc-settings',
      storage: createJSONStorage(() => tauriStorage),
      version: 19,
      migrate: (persistedState) => {
        const prev = (persistedState ?? {}) as Partial<SettingsState> & {
          soundwaveDiversity?: number;
        };
        // v13 → v14: diversity-slider (0..1) → toggle ('similar' | 'diverse').
        // > 0.5 трактуем как 'diverse', иначе 'similar'.
        const inferredMode: 'similar' | 'diverse' =
          typeof prev.soundwaveDiversity === 'number' && prev.soundwaveDiversity > 0.5
            ? 'diverse'
            : 'similar';
        return {
          ...DEFAULTS,
          ...prev,
          soundwaveMode: prev.soundwaveMode ?? inferredMode,
        } as SettingsState;
      },
      partialize: (s) => ({
        accentColor: s.accentColor,
        bgPrimary: s.bgPrimary,
        themePreset: s.themePreset,
        perfMode: s.perfMode,
        perfModeUserSet: s.perfModeUserSet,
        perfProbed: s.perfProbed,
        backgroundImage: s.backgroundImage,
        backgroundOpacity: s.backgroundOpacity,
        backgroundDim: s.backgroundDim,
        backgroundBlur: s.backgroundBlur,
        wallpaperRotation: s.wallpaperRotation,
        wallpaperRotationNames: s.wallpaperRotationNames,
        wallpaperRotationMinutes: s.wallpaperRotationMinutes,
        wallpaperRotationOrder: s.wallpaperRotationOrder,
        glassBlur: s.glassBlur,
        audioCacheLimitMB: s.audioCacheLimitMB,
        hoverPreload: s.hoverPreload,
        language: s.language,
        eqEnabled: s.eqEnabled,
        eqGains: s.eqGains,
        eqPreset: s.eqPreset,
        normalizeVolume: s.normalizeVolume,
        highQualityStreaming: s.highQualityStreaming,
        bypassWhitelist: s.bypassWhitelist,
        sidebarCollapsed: s.sidebarCollapsed,
        floatingComments: s.floatingComments,
        startupPage: s.startupPage,
        pinnedPlaylists: s.pinnedPlaylists,
        discordRpcEnabled: s.discordRpcEnabled,
        discordRpcMode: s.discordRpcMode,
        discordRpcShowButton: s.discordRpcShowButton,
        soundwaveLanguages: s.soundwaveLanguages,
        soundwaveMode: s.soundwaveMode,
        soundwaveHideLiked: s.soundwaveHideLiked,
        soundwaveHideListened: s.soundwaveHideListened,
        lyricsVisualizer: s.lyricsVisualizer,
        lyricsHighlight: s.lyricsHighlight,
        artistWaveCollapsed: s.artistWaveCollapsed,
        wallhavenApiKey: s.wallhavenApiKey,
        showErrorToasts: s.showErrorToasts,
        interfaceFont: s.interfaceFont,
        customFontName: s.customFontName,
        coverTint: s.coverTint,
        coverAccent: s.coverAccent,
        customCss: s.customCss,
        customCssEnabled: s.customCssEnabled,
        layouts: s.layouts,
        riverHidden: s.riverHidden,
      }),
    },
  ),
);
