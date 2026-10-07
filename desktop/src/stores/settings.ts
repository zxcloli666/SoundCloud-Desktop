import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {PerfMode} from '../lib/perf';
import {tauriStorage} from '../lib/tauri-storage';
import type {TrackSort} from '../lib/track-sort';

export type ThemePreset = 'soundcloud' | 'dark' | 'neon' | 'forest' | 'crimson' | 'custom';
export type StartupPage = 'home' | 'search' | 'library' | 'settings';
export type DiscordRpcMode = 'track' | 'artist' | 'activity';
export type YmImportOrder = 'newest' | 'oldest';
export interface SidebarPinnedPlaylist {
  urn: string;
  title: string;
  artworkUrl: string | null;
}

export interface SidebarPinnedArtist {
  id: string;
  name: string;
  avatarUrl: string | null;
  path: string;
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
  pinnedArtists: SidebarPinnedArtist[];
  discordRpcEnabled: boolean;
  discordRpcMode: DiscordRpcMode;
  discordRpcShowButton: boolean;
  soundwaveLanguages: string[];
  soundwaveMode: 'similar' | 'diverse';
  soundwaveHideLiked: boolean;
  soundwaveHideListened: boolean;
  lyricsVisualizer: boolean;
  artistWaveCollapsed: boolean;
  wallhavenApiKey: string;
  ymImportOrder: YmImportOrder;
  likesSort: TrackSort;
  playlistSorts: Record<string, TrackSort>;
  setAccentColor: (color: string) => void;
  setBgPrimary: (bg: string) => void;
  setThemePreset: (id: ThemePreset) => void;
  setPerfMode: (mode: PerfMode) => void;
  setBackgroundImage: (url: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setBackgroundDim: (dim: number) => void;
  setBackgroundBlur: (blur: number) => void;
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
  renamePinnedPlaylist: (urn: string, title: string) => void;
  pinArtist: (artist: SidebarPinnedArtist) => void;
  unpinArtist: (id: string) => void;
  refreshPinnedArtist: (artist: SidebarPinnedArtist) => void;
  setDiscordRpcEnabled: (enabled: boolean) => void;
  setDiscordRpcMode: (mode: DiscordRpcMode) => void;
  setDiscordRpcShowButton: (show: boolean) => void;
  setSoundwaveLanguages: (langs: string[]) => void;
  setSoundwaveMode: (mode: 'similar' | 'diverse') => void;
  setSoundwaveHideLiked: (v: boolean) => void;
  setSoundwaveHideListened: (v: boolean) => void;
  setLyricsVisualizer: (v: boolean) => void;
  setArtistWaveCollapsed: (v: boolean) => void;
  setWallhavenApiKey: (key: string) => void;
  setYmImportOrder: (order: YmImportOrder) => void;
  setLikesSort: (sort: TrackSort) => void;
  setPlaylistSort: (urn: string, sort: TrackSort) => void;
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
  pinnedArtists: [] as SidebarPinnedArtist[],
  discordRpcEnabled: true,
  discordRpcMode: 'track' as DiscordRpcMode,
  discordRpcShowButton: true,
  soundwaveLanguages: [] as string[],
  soundwaveMode: 'similar' as 'similar' | 'diverse',
  soundwaveHideLiked: false,
  soundwaveHideListened: true,
  lyricsVisualizer: false,
  artistWaveCollapsed: false,
  wallhavenApiKey: '',
  ymImportOrder: 'newest' as YmImportOrder,
  likesSort: 'default' as TrackSort,
  playlistSorts: {} as Record<string, TrackSort>,
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
      renamePinnedPlaylist: (urn, title) =>
        set((s) => ({
          pinnedPlaylists: s.pinnedPlaylists.map((item) =>
            item.urn === urn ? { ...item, title } : item,
          ),
        })),
      pinArtist: (artist) =>
        set((s) => ({
          pinnedArtists: [artist, ...s.pinnedArtists.filter((item) => item.id !== artist.id)].slice(
            0,
            8,
          ),
        })),
      unpinArtist: (id) =>
        set((s) => ({
          pinnedArtists: s.pinnedArtists.filter((item) => item.id !== id),
        })),
      refreshPinnedArtist: (artist) =>
        set((s) => ({
          pinnedArtists: s.pinnedArtists.map((item) => (item.id === artist.id ? artist : item)),
        })),
      setDiscordRpcEnabled: (discordRpcEnabled) => set({ discordRpcEnabled }),
      setDiscordRpcMode: (discordRpcMode) => set({ discordRpcMode }),
      setDiscordRpcShowButton: (discordRpcShowButton) => set({ discordRpcShowButton }),
      setSoundwaveLanguages: (soundwaveLanguages) => set({ soundwaveLanguages }),
      setSoundwaveMode: (soundwaveMode) => set({ soundwaveMode }),
      setSoundwaveHideLiked: (soundwaveHideLiked) => set({ soundwaveHideLiked }),
      setSoundwaveHideListened: (soundwaveHideListened) => set({ soundwaveHideListened }),
      setLyricsVisualizer: (lyricsVisualizer) => set({ lyricsVisualizer }),
      setArtistWaveCollapsed: (artistWaveCollapsed) => set({ artistWaveCollapsed }),
      setWallhavenApiKey: (wallhavenApiKey) => set({ wallhavenApiKey }),
      setYmImportOrder: (ymImportOrder) => set({ ymImportOrder }),
      setLikesSort: (likesSort) => set({ likesSort }),
      setPlaylistSort: (urn, sort) =>
        set((s) => {
          const { [urn]: _, ...rest } = s.playlistSorts;
          return { playlistSorts: sort === 'default' ? rest : { ...rest, [urn]: sort } };
        }),
      resetTheme: () =>
        set({
          accentColor: DEFAULTS.accentColor,
          bgPrimary: DEFAULTS.bgPrimary,
          themePreset: DEFAULTS.themePreset,
          backgroundImage: DEFAULTS.backgroundImage,
          backgroundOpacity: DEFAULTS.backgroundOpacity,
          backgroundDim: DEFAULTS.backgroundDim,
          backgroundBlur: DEFAULTS.backgroundBlur,
          glassBlur: DEFAULTS.glassBlur,
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
        pinnedArtists: s.pinnedArtists,
        discordRpcEnabled: s.discordRpcEnabled,
        discordRpcMode: s.discordRpcMode,
        discordRpcShowButton: s.discordRpcShowButton,
        soundwaveLanguages: s.soundwaveLanguages,
        soundwaveMode: s.soundwaveMode,
        soundwaveHideLiked: s.soundwaveHideLiked,
        soundwaveHideListened: s.soundwaveHideListened,
        lyricsVisualizer: s.lyricsVisualizer,
        artistWaveCollapsed: s.artistWaveCollapsed,
        wallhavenApiKey: s.wallhavenApiKey,
        ymImportOrder: s.ymImportOrder,
        likesSort: s.likesSort,
        playlistSorts: s.playlistSorts,
      }),
    },
  ),
);
