import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {normalizeAudioCacheLimit, normalizeImageCacheLimit} from '../lib/cache-limit';
import {EQ_CUSTOM_PRESET_LIMIT, EQ_PRESET_NAME_MAX, type EqCustomPreset} from '../lib/equalizer';
import {
  DEFAULT_GLOBAL_HOTKEYS,
  type GlobalHotkeyAction,
  type GlobalHotkeyMap,
} from '../lib/hotkeys/actions';
import type {PerfMode} from '../lib/perf';
import {tauriStorage} from '../lib/tauri-storage';
import type {TrackSort} from '../lib/track-sort';

export type ThemePreset = 'soundcloud' | 'dark' | 'neon' | 'forest' | 'crimson' | 'custom';
export type StartupPage = 'home' | 'search' | 'library' | 'settings';
export type CloseAction = 'tray' | 'quit';
export type DiscordRpcMode = 'track' | 'artist' | 'activity';
export type StreamQuality = 'auto' | 'sq' | 'hq';
export type SkipStuckAfterSec = 0 | 10 | 20 | 30 | 60;
export type SearchPlayback = 'similar' | 'results';
export const CROSSFADE_MAX_SEC = 12;
export type DiscordRpcStatus = 'app' | 'track' | 'artist';
export type ObsTheme = 'card' | 'minimal' | 'vinyl';
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
  imageCacheLimitMB: number;
  hoverPreload: boolean;
  language: string;
  eqEnabled: boolean;
  eqGains: number[];
  eqPreset: string;
  eqCustomPresets: EqCustomPreset[];
  normalizeVolume: boolean;
  skipSilence: boolean;
  streamQuality: StreamQuality;
  skipStuckAfterSec: SkipStuckAfterSec;
  crossfadeSec: number;
  autoplay: boolean;
  searchPlayback: SearchPlayback;
  bypassWhitelist: boolean;
  sidebarCollapsed: boolean;
  floatingComments: boolean;
  startupPage: StartupPage;
  closeAction: CloseAction;
  uiScale: number;
  pinnedPlaylists: SidebarPinnedPlaylist[];
  pinnedArtists: SidebarPinnedArtist[];
  discordRpcEnabled: boolean;
  discordRpcMode: DiscordRpcMode;
  discordRpcStatus: DiscordRpcStatus;
  discordRpcShowButton: boolean;
  discordRpcLyrics: boolean;
  scrobbleEnabled: boolean;
  scrobbleNowPlaying: boolean;
  obsEnabled: boolean;
  obsServer: boolean;
  obsPort: number;
  obsTheme: ObsTheme;
  obsProgress: boolean;
  obsHidePaused: boolean;
  obsTxt: boolean;
  obsTxtPath: string;
  obsTemplate: string;
  soundwaveLanguages: string[];
  soundwaveMode: 'similar' | 'diverse';
  soundwaveHideLiked: boolean;
  soundwaveHideListened: boolean;
  lyricsVisualizer: boolean;
  artistWaveCollapsed: boolean;
  wallhavenApiKey: string;
  globalHotkeysEnabled: boolean;
  globalHotkeys: GlobalHotkeyMap;
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
  setImageCacheLimitMB: (limit: number) => void;
  setHoverPreload: (enabled: boolean) => void;
  setLanguage: (lang: string) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqGains: (gains: number[]) => void;
  setEqPreset: (preset: string) => void;
  setEqBand: (index: number, gain: number) => void;
  saveEqCustomPreset: (name: string) => void;
  deleteEqCustomPreset: (id: string) => void;
  setNormalizeVolume: (enabled: boolean) => void;
  setSkipSilence: (enabled: boolean) => void;
  setStreamQuality: (quality: StreamQuality) => void;
  setSkipStuckAfterSec: (seconds: SkipStuckAfterSec) => void;
  setCrossfadeSec: (seconds: number) => void;
  setAutoplay: (enabled: boolean) => void;
  setSearchPlayback: (mode: SearchPlayback) => void;
  setBypassWhitelist: (enabled: boolean) => void;
  toggleSidebar: () => void;
  setFloatingComments: (v: boolean) => void;
  setStartupPage: (page: StartupPage) => void;
  setCloseAction: (action: CloseAction) => void;
  setUiScale: (scale: number) => void;
  pinPlaylist: (playlist: SidebarPinnedPlaylist) => void;
  unpinPlaylist: (urn: string) => void;
  renamePinnedPlaylist: (urn: string, title: string) => void;
  pinArtist: (artist: SidebarPinnedArtist) => void;
  unpinArtist: (id: string) => void;
  refreshPinnedArtist: (artist: SidebarPinnedArtist) => void;
  setDiscordRpcEnabled: (enabled: boolean) => void;
  setDiscordRpcMode: (mode: DiscordRpcMode) => void;
  setDiscordRpcStatus: (status: DiscordRpcStatus) => void;
  setDiscordRpcShowButton: (show: boolean) => void;
  setDiscordRpcLyrics: (enabled: boolean) => void;
  setScrobbleEnabled: (enabled: boolean) => void;
  setScrobbleNowPlaying: (enabled: boolean) => void;
  setObsEnabled: (enabled: boolean) => void;
  setObsServer: (enabled: boolean) => void;
  setObsPort: (port: number) => void;
  setObsTheme: (theme: ObsTheme) => void;
  setObsProgress: (enabled: boolean) => void;
  setObsHidePaused: (enabled: boolean) => void;
  setObsTxt: (enabled: boolean) => void;
  setObsTxtPath: (path: string) => void;
  setObsTemplate: (template: string) => void;
  setSoundwaveLanguages: (langs: string[]) => void;
  setSoundwaveMode: (mode: 'similar' | 'diverse') => void;
  setSoundwaveHideLiked: (v: boolean) => void;
  setSoundwaveHideListened: (v: boolean) => void;
  setLyricsVisualizer: (v: boolean) => void;
  setArtistWaveCollapsed: (v: boolean) => void;
  setWallhavenApiKey: (key: string) => void;
  setGlobalHotkeysEnabled: (enabled: boolean) => void;
  setGlobalHotkey: (action: GlobalHotkeyAction, accelerator: string) => void;
  resetGlobalHotkeys: () => void;
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
  imageCacheLimitMB: 1024,
  hoverPreload: true,
  language: navigator.language?.split('-')[0] || 'en',
  eqEnabled: false,
  eqGains: DEFAULT_EQ_GAINS,
  eqPreset: 'flat',
  eqCustomPresets: [] as EqCustomPreset[],
  normalizeVolume: true,
  skipSilence: false,
  streamQuality: 'auto' as StreamQuality,
  skipStuckAfterSec: 0 as SkipStuckAfterSec,
  crossfadeSec: 0,
  autoplay: true,
  searchPlayback: 'similar' as SearchPlayback,
  bypassWhitelist: false,
  sidebarCollapsed: false,
  floatingComments: true,
  startupPage: 'home' as StartupPage,
  closeAction: 'tray' as CloseAction,
  uiScale: 100,
  pinnedPlaylists: [] as SidebarPinnedPlaylist[],
  pinnedArtists: [] as SidebarPinnedArtist[],
  discordRpcEnabled: true,
  discordRpcMode: 'track' as DiscordRpcMode,
  discordRpcStatus: 'track' as DiscordRpcStatus,
  discordRpcShowButton: true,
  discordRpcLyrics: false,
  scrobbleEnabled: true,
  scrobbleNowPlaying: true,
  obsEnabled: false,
  obsServer: true,
  obsPort: 48555,
  obsTheme: 'card' as ObsTheme,
  obsProgress: true,
  obsHidePaused: false,
  obsTxt: false,
  obsTxtPath: '',
  obsTemplate: '{artist} - {title}',
  soundwaveLanguages: [] as string[],
  soundwaveMode: 'similar' as 'similar' | 'diverse',
  soundwaveHideLiked: false,
  soundwaveHideListened: true,
  lyricsVisualizer: false,
  artistWaveCollapsed: false,
  wallhavenApiKey: '',
  globalHotkeysEnabled: false,
  globalHotkeys: DEFAULT_GLOBAL_HOTKEYS,
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
      setImageCacheLimitMB: (imageCacheLimitMB) => set({ imageCacheLimitMB }),
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
      saveEqCustomPreset: (rawName) =>
        set((s) => {
          const name = rawName.trim().slice(0, EQ_PRESET_NAME_MAX);
          if (!name) return {};
          const gains = [...s.eqGains];
          const existing = s.eqCustomPresets.find(
            (p) => p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
          );
          if (existing) {
            return {
              eqCustomPresets: s.eqCustomPresets.map((p) =>
                p.id === existing.id ? { ...p, name, gains } : p,
              ),
              eqPreset: existing.id,
            };
          }
          if (s.eqCustomPresets.length >= EQ_CUSTOM_PRESET_LIMIT) return {};
          const id = `user-${Date.now().toString(36)}`;
          return { eqCustomPresets: [...s.eqCustomPresets, { id, name, gains }], eqPreset: id };
        }),
      deleteEqCustomPreset: (id) =>
        set((s) => ({
          eqCustomPresets: s.eqCustomPresets.filter((p) => p.id !== id),
          eqPreset: s.eqPreset === id ? 'custom' : s.eqPreset,
        })),
      setNormalizeVolume: (normalizeVolume) => set({ normalizeVolume }),
      setSkipSilence: (skipSilence) => set({ skipSilence }),
      setStreamQuality: (streamQuality) => set({ streamQuality }),
      setSkipStuckAfterSec: (skipStuckAfterSec) => set({ skipStuckAfterSec }),
      setCrossfadeSec: (seconds) =>
        set({ crossfadeSec: Math.min(CROSSFADE_MAX_SEC, Math.max(0, Math.round(seconds))) }),
      setAutoplay: (autoplay) => set({ autoplay }),
      setSearchPlayback: (searchPlayback) => set({ searchPlayback }),
      setBypassWhitelist: (bypassWhitelist) => set({ bypassWhitelist }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setFloatingComments: (floatingComments) => set({ floatingComments }),
      setStartupPage: (startupPage) => set({ startupPage }),
      setCloseAction: (closeAction) => set({ closeAction }),
      setUiScale: (uiScale) => set({ uiScale }),
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
      setDiscordRpcStatus: (discordRpcStatus) => set({ discordRpcStatus }),
      setDiscordRpcShowButton: (discordRpcShowButton) => set({ discordRpcShowButton }),
      setDiscordRpcLyrics: (discordRpcLyrics) => set({ discordRpcLyrics }),
      setScrobbleEnabled: (scrobbleEnabled) => set({ scrobbleEnabled }),
      setScrobbleNowPlaying: (scrobbleNowPlaying) => set({ scrobbleNowPlaying }),
      setObsEnabled: (obsEnabled) => set({ obsEnabled }),
      setObsServer: (obsServer) => set({ obsServer }),
      setObsPort: (obsPort) => set({ obsPort }),
      setObsTheme: (obsTheme) => set({ obsTheme }),
      setObsProgress: (obsProgress) => set({ obsProgress }),
      setObsHidePaused: (obsHidePaused) => set({ obsHidePaused }),
      setObsTxt: (obsTxt) => set({ obsTxt }),
      setObsTxtPath: (obsTxtPath) => set({ obsTxtPath }),
      setObsTemplate: (obsTemplate) => set({ obsTemplate }),
      setSoundwaveLanguages: (soundwaveLanguages) => set({ soundwaveLanguages }),
      setSoundwaveMode: (soundwaveMode) => set({ soundwaveMode }),
      setSoundwaveHideLiked: (soundwaveHideLiked) => set({ soundwaveHideLiked }),
      setSoundwaveHideListened: (soundwaveHideListened) => set({ soundwaveHideListened }),
      setLyricsVisualizer: (lyricsVisualizer) => set({ lyricsVisualizer }),
      setArtistWaveCollapsed: (artistWaveCollapsed) => set({ artistWaveCollapsed }),
      setWallhavenApiKey: (wallhavenApiKey) => set({ wallhavenApiKey }),
      setGlobalHotkeysEnabled: (globalHotkeysEnabled) => set({ globalHotkeysEnabled }),
      setGlobalHotkey: (action, accelerator) =>
        set((s) => ({ globalHotkeys: { ...s.globalHotkeys, [action]: accelerator } })),
      resetGlobalHotkeys: () => set({ globalHotkeys: DEFAULT_GLOBAL_HOTKEYS }),
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
      version: 21,
      migrate: (persistedState, version) => {
        const prev = (persistedState ?? {}) as Partial<SettingsState> & {
          soundwaveDiversity?: number;
          highQualityStreaming?: boolean;
        };
        const { highQualityStreaming, ...kept } = prev;
        // v13 → v14: diversity-slider (0..1) → toggle ('similar' | 'diverse').
        // > 0.5 трактуем как 'diverse', иначе 'similar'.
        const inferredMode: 'similar' | 'diverse' =
          typeof prev.soundwaveDiversity === 'number' && prev.soundwaveDiversity > 0.5
            ? 'diverse'
            : 'similar';
        const next = {
          ...DEFAULTS,
          ...kept,
          soundwaveMode: prev.soundwaveMode ?? inferredMode,
        } as SettingsState;
        if (version < 20) {
          next.audioCacheLimitMB = normalizeAudioCacheLimit(next.audioCacheLimitMB);
          next.imageCacheLimitMB = normalizeImageCacheLimit(next.imageCacheLimitMB);
        }
        if (version < 21) {
          next.streamQuality = prev.streamQuality ?? (highQualityStreaming ? 'hq' : 'auto');
        }
        return next;
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
        imageCacheLimitMB: s.imageCacheLimitMB,
        hoverPreload: s.hoverPreload,
        language: s.language,
        eqEnabled: s.eqEnabled,
        eqGains: s.eqGains,
        eqPreset: s.eqPreset,
        eqCustomPresets: s.eqCustomPresets,
        normalizeVolume: s.normalizeVolume,
        skipSilence: s.skipSilence,
        streamQuality: s.streamQuality,
        skipStuckAfterSec: s.skipStuckAfterSec,
        crossfadeSec: s.crossfadeSec,
        autoplay: s.autoplay,
        searchPlayback: s.searchPlayback,
        bypassWhitelist: s.bypassWhitelist,
        sidebarCollapsed: s.sidebarCollapsed,
        floatingComments: s.floatingComments,
        startupPage: s.startupPage,
        closeAction: s.closeAction,
        uiScale: s.uiScale,
        pinnedPlaylists: s.pinnedPlaylists,
        pinnedArtists: s.pinnedArtists,
        discordRpcEnabled: s.discordRpcEnabled,
        discordRpcMode: s.discordRpcMode,
        discordRpcStatus: s.discordRpcStatus,
        discordRpcShowButton: s.discordRpcShowButton,
        discordRpcLyrics: s.discordRpcLyrics,
        scrobbleEnabled: s.scrobbleEnabled,
        scrobbleNowPlaying: s.scrobbleNowPlaying,
        obsEnabled: s.obsEnabled,
        obsServer: s.obsServer,
        obsPort: s.obsPort,
        obsTheme: s.obsTheme,
        obsProgress: s.obsProgress,
        obsHidePaused: s.obsHidePaused,
        obsTxt: s.obsTxt,
        obsTxtPath: s.obsTxtPath,
        obsTemplate: s.obsTemplate,
        soundwaveLanguages: s.soundwaveLanguages,
        soundwaveMode: s.soundwaveMode,
        soundwaveHideLiked: s.soundwaveHideLiked,
        soundwaveHideListened: s.soundwaveHideListened,
        lyricsVisualizer: s.lyricsVisualizer,
        artistWaveCollapsed: s.artistWaveCollapsed,
        wallhavenApiKey: s.wallhavenApiKey,
        globalHotkeysEnabled: s.globalHotkeysEnabled,
        globalHotkeys: s.globalHotkeys,
        ymImportOrder: s.ymImportOrder,
        likesSort: s.likesSort,
        playlistSorts: s.playlistSorts,
      }),
    },
  ),
);
