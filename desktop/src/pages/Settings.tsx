import { listen } from '@tauri-apps/api/event';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CallProxySection } from '../components/settings/CallProxySection.tsx';
import { Skeleton } from '../components/ui/Skeleton.tsx';
import { changeAppLanguage } from '../i18n';
import { switchAudioDevice } from '../lib/audio';
import {
  cacheLikedTracks,
  cancelCacheLikes,
  clearCache,
  clearImageCache,
  clearLikedCache,
  downloadWallpaper,
  getCacheSize,
  getImageCacheSize,
  getLikedCacheSize,
  getWallpaperUrl,
  isCacheLikesRunning,
  type LikeCacheEntry,
  listWallpapers,
  removeWallpaper,
  saveWallpaperFromBuffer,
} from '../lib/cache';
import { trackedInvoke } from '../lib/diagnostics';
import { Download, Globe, Link, Loader2, Star, Trash2, X } from '../lib/icons';
import { useSubscription } from '../lib/subscription';
import { useAuthStore } from '../stores/auth';
import {
  type DiscordRpcMode,
  type StartupPage,
  THEME_PRESETS,
  useSettingsStore,
} from '../stores/settings';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const PRESET_COLORS = [
  '#ff5500',
  '#ff3366',
  '#7c3aed',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
  '#eab308',
  '#ef4444',
  '#f97316',
  '#8b5cf6',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Русский' },
  { code: 'tr', label: 'Turkce' },
] as const;

const STARTUP_PAGES: Array<{ id: StartupPage; labelKey: string }> = [
  { id: 'home', labelKey: 'nav.home' },
  { id: 'search', labelKey: 'nav.search' },
  { id: 'library', labelKey: 'nav.library' },
  { id: 'settings', labelKey: 'nav.settings' },
];

const DISCORD_RPC_MODES: Array<{ id: DiscordRpcMode; labelKey: string }> = [
  { id: 'track', labelKey: 'settings.discordRpcModeTrack' },
  { id: 'artist', labelKey: 'settings.discordRpcModeArtist' },
  { id: 'activity', labelKey: 'settings.discordRpcModeActivity' },
];

/* ── Language Section ─────────────────────────────────────── */

const LanguageSection = React.memo(function LanguageSection() {
  const { t, i18n } = useTranslation();

  return (
    <section className="liquid-panel rounded-[30px] p-6">
      <h3 className="text-[15px] font-bold text-white/80 tracking-tight mb-4">
        {t('settings.language')}
      </h3>
      <div className="flex gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => void changeAppLanguage(lang.code)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[18px] text-[13px] font-semibold transition-all duration-200 cursor-pointer border ${
              i18n.language === lang.code
                ? 'liquid-control text-white/90 border-white/[0.20]'
                : 'text-white/48 border-white/[0.08] hover:bg-white/[0.075] hover:text-white/76'
            }`}
          >
            <Globe size={14} strokeWidth={1.8} />
            {lang.label}
          </button>
        ))}
      </div>
    </section>
  );
});

/* ── Cache Section ──────────────────────────────────────── */

function CacheRow({
  label,
  size,
  clearing,
  onClear,
  t,
}: {
  label: string;
  size: number | null;
  clearing: boolean;
  onClear: () => void;
  t: (k: string) => string;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-[13px] text-white/60 font-medium">{label}</p>

          <div className="h-[25px] flex items-center">
            {size === null ? (
              <Skeleton className="w-25 h-[20px]" />
            ) : (
              <p className="text-[17px] font-bold text-white/90 tabular-nums">
                {formatBytes(size)}
              </p>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onClear}
        disabled={clearing || size === 0}
        className="flex items-center gap-2 px-4 py-2 rounded-[18px] text-[12px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/20 transition-all duration-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
      >
        {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {t('settings.clearCache')}
      </button>
    </div>
  );
}

const CacheSection = React.memo(function CacheSection() {
  const { t } = useTranslation();
  const audioCacheLimitMB = useSettingsStore((s) => s.audioCacheLimitMB);
  const setAudioCacheLimitMB = useSettingsStore((s) => s.setAudioCacheLimitMB);
  const [audioSize, setAudioSize] = useState<number | null>(null);
  const [imagesSize, setImagesSize] = useState<number | null>(null);
  const [likedSize, setLikedSize] = useState<number | null>(null);
  const [clearingAudio, setClearingAudio] = useState(false);
  const [clearingImages, setClearingImages] = useState(false);
  const [clearingLiked, setClearingLiked] = useState(false);
  const [cachingLikes, setCachingLikes] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    failed: number;
    skipped: number;
  } | null>(null);

  const refreshLikedSize = useCallback(() => {
    void getLikedCacheSize().then(setLikedSize);
  }, []);

  useEffect(() => {
    void getCacheSize().then(setAudioSize);
    void getImageCacheSize().then(setImagesSize);
    refreshLikedSize();
    void isCacheLikesRunning().then((running) => {
      if (running) setCachingLikes(true);
    });
  }, [refreshLikedSize]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void listen<{
      phase: 'start' | 'progress' | 'done' | 'cancelled';
      total: number;
      done: number;
      failed: number;
      skipped: number;
    }>('track:cache-likes-progress', (event) => {
      const p = event.payload;
      if (p.phase === 'start') {
        setCachingLikes(true);
        setProgress({ done: 0, total: p.total, failed: 0, skipped: 0 });
      } else if (p.phase === 'progress') {
        setProgress({
          done: p.done,
          total: p.total,
          failed: p.failed,
          skipped: p.skipped,
        });
      } else {
        setCachingLikes(false);
        setProgress(null);
        refreshLikedSize();
        if (p.phase === 'done') {
          toast.success(
            t('settings.cacheLikesDone', {
              done: p.done - p.failed,
              total: p.total,
            }),
          );
        }
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [refreshLikedSize, t]);

  const handleClearAudio = useCallback(async () => {
    setClearingAudio(true);
    try {
      await clearCache();
      setAudioSize(0);
      toast.success(t('settings.cacheCleared'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setClearingAudio(false);
    }
  }, [t]);

  const handleClearImages = useCallback(async () => {
    setClearingImages(true);
    try {
      await clearImageCache();
      setImagesSize(0);
      toast.success(t('settings.cacheCleared'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setClearingImages(false);
    }
  }, [t]);

  const handleClearLiked = useCallback(async () => {
    setClearingLiked(true);
    try {
      await clearLikedCache();
      setLikedSize(0);
      toast.success(t('settings.cacheCleared'));
    } catch {
      toast.error(t('common.error'));
    } finally {
      setClearingLiked(false);
    }
  }, [t]);

  const handleCacheLikes = useCallback(async () => {
    setCachingLikes(true);
    try {
      const [{ fetchAllLikedTracks }, { buildStorageUrls, streamFallbackUrls, getSessionId }] =
        await Promise.all([import('../lib/hooks'), import('../lib/api')]);
      const hq = useSettingsStore.getState().highQualityStreaming;
      const sessionId = getSessionId();
      const tracks = await fetchAllLikedTracks(200);
      const entries: LikeCacheEntry[] = tracks.map((track) => ({
        urn: track.urn,
        urls: streamFallbackUrls(track.urn, hq),
        storageUrls: buildStorageUrls(track.urn, hq),
        sessionId,
      }));
      if (entries.length === 0) {
        setCachingLikes(false);
        toast(t('settings.cacheLikesEmpty'));
        return;
      }
      await cacheLikedTracks(entries);
    } catch (err) {
      setCachingLikes(false);
      setProgress(null);
      toast.error(String(err));
    }
  }, [t]);

  const handleCancelCacheLikes = useCallback(() => {
    void cancelCacheLikes();
  }, []);

  const totalSize = (audioSize ?? 0) + (imagesSize ?? 0) + (likedSize ?? 0);
  const limitLabel =
    audioCacheLimitMB <= 0
      ? t('settings.unlimited')
      : audioCacheLimitMB >= 1024
        ? `${(audioCacheLimitMB / 1024).toFixed(audioCacheLimitMB % 1024 === 0 ? 0 : 1)} GB`
        : `${audioCacheLimitMB} MB`;

  const progressPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0;

  return (
    <section className="liquid-panel rounded-[30px] p-6 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-bold text-white/80 tracking-tight">
          {t('settings.cache')}
        </h3>

        <div className="min-w-[80px] flex justify-end">
          {audioSize !== null && imagesSize !== null && likedSize !== null ? (
            <span className="text-[12px] text-white/30 tabular-nums">
              {t('settings.total')}: {formatBytes(totalSize)}
            </span>
          ) : (
            <Skeleton className="h-[12px] w-[80px]" />
          )}
        </div>
      </div>
      <CacheRow
        label={t('settings.audioCacheSize')}
        size={audioSize}
        clearing={clearingAudio}
        onClear={handleClearAudio}
        t={t}
      />
      <div className="border-t border-white/[0.10]" />
      <CacheRow
        label={t('settings.assetsCacheSize')}
        size={imagesSize}
        clearing={clearingImages}
        onClear={handleClearImages}
        t={t}
      />
      <div className="border-t border-white/[0.10]" />
      <CacheRow
        label={t('settings.likedCacheSize')}
        size={likedSize}
        clearing={clearingLiked}
        onClear={handleClearLiked}
        t={t}
      />

      <div className="pt-2 space-y-2">
        <p className="text-[11px] text-white/30">{t('settings.cacheLikesDesc')}</p>
        {cachingLikes ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px] text-white/60">
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                {progress
                  ? t('settings.cacheLikesProgress', {
                      done: progress.done,
                      total: progress.total,
                    })
                  : t('settings.cacheLikesStarting')}
              </span>
              {progress && progress.failed > 0 && (
                <span className="text-red-400/80 tabular-nums">
                  {t('settings.cacheLikesFailed', { count: progress.failed })}
                </span>
              )}
            </div>
            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--color-accent)] transition-[width] duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <button
              onClick={handleCancelCacheLikes}
              className="flex items-center gap-2 px-4 py-2 rounded-[18px] text-[12px] font-semibold liquid-control text-white/66 transition-all duration-200 cursor-pointer"
            >
              <X size={12} />
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={handleCacheLikes}
            className="liquid-control flex cursor-pointer items-center gap-2 rounded-[18px] px-4 py-2 text-[12px] font-semibold text-white/78 transition-all duration-200"
          >
            <Download size={12} />
            {t('settings.cacheLikes')}
          </button>
        )}
      </div>

      <div className="border-t border-white/[0.10]" />
      <div className="pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-white/60 font-medium">{t('settings.audioCacheLimit')}</p>
            <p className="text-[11px] text-white/30 mt-0.5">{t('settings.audioCacheLimitDesc')}</p>
          </div>
          <span className="text-[12px] text-white/30 tabular-nums">{limitLabel}</span>
        </div>
        <input
          type="range"
          min={0}
          max={8192}
          step={256}
          value={audioCacheLimitMB}
          onChange={(e) => setAudioCacheLimitMB(Number(e.target.value))}
          className="w-full accent-[var(--color-accent)] h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
        />
      </div>
    </section>
  );
});

/* ── Wallpaper Picker ───────────────────────────────────── */

const WallpaperPicker = React.memo(function WallpaperPicker() {
  const { t } = useTranslation();
  const backgroundImage = useSettingsStore((s) => s.backgroundImage);
  const setBackgroundImage = useSettingsStore((s) => s.setBackgroundImage);

  const [wallpapers, setWallpapers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listWallpapers().then((names) => {
      setWallpapers(names);
      setLoading(false);
    });
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const buffer = await file.arrayBuffer();
        const name = await saveWallpaperFromBuffer(buffer, file.name);
        setWallpapers((prev) => [...prev, name]);
        setBackgroundImage(name);
        toast.success(t('settings.wallpaperAdded'));
      } catch {
        toast.error(t('common.error'));
      }
      e.target.value = '';
    },
    [setBackgroundImage, t],
  );

  const handleDownloadUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setDownloading(true);
    try {
      const name = await downloadWallpaper(url);
      setWallpapers((prev) => [...prev, name]);
      setBackgroundImage(name);
      setUrlInput('');
      setShowUrlInput(false);
      toast.success(t('settings.wallpaperAdded'));
    } catch {
      toast.error(t('settings.bgLoadError'));
    } finally {
      setDownloading(false);
    }
  }, [urlInput, setBackgroundImage, t]);

  const handleRemove = useCallback(
    async (name: string) => {
      await removeWallpaper(name);
      setWallpapers((prev) => prev.filter((w) => w !== name));
      if (backgroundImage === name) {
        setBackgroundImage('');
      }
    },
    [backgroundImage, setBackgroundImage],
  );

  const handleSelect = useCallback(
    (name: string) => {
      setBackgroundImage(backgroundImage === name ? '' : name);
    },
    [backgroundImage, setBackgroundImage],
  );

  return (
    <div className="space-y-3">
      <label className="text-[13px] text-white/50 font-medium">
        {t('settings.backgroundImage')}
      </label>

      {/* Wallpaper grid */}
      <div className="flex flex-wrap gap-3">
        {/* "None" option */}
        <button
          onClick={() => setBackgroundImage('')}
          className={`w-20 h-14 rounded-xl border-2 transition-all duration-200 cursor-pointer flex items-center justify-center ${
            !backgroundImage
              ? 'border-white/40 bg-white/[0.08]'
              : 'border-white/[0.12] bg-white/[0.045] hover:border-white/[0.12]'
          }`}
        >
          <span className="text-[10px] text-white/40 font-semibold">{t('settings.none')}</span>
        </button>

        {/* Saved wallpapers */}
        {wallpapers.map((name) => {
          const url = getWallpaperUrl(name);
          return (
            <div
              key={name}
              className={`relative group w-20 h-14 rounded-xl overflow-hidden border-2 transition-all duration-200 cursor-pointer ${
                backgroundImage === name
                  ? 'border-white/40 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                  : 'border-white/[0.12] hover:border-white/[0.15]'
              }`}
              onClick={() => handleSelect(name)}
            >
              {url && <img src={url} alt="" className="w-full h-full object-cover" />}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(name);
                }}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-red-500/80"
              >
                <X size={8} className="text-white" />
              </button>
              {backgroundImage === name && (
                <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-white shadow-lg" />
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="w-20 h-14 rounded-xl bg-white/[0.045] border border-white/[0.12] flex items-center justify-center">
            <Loader2 size={14} className="animate-spin text-white/20" />
          </div>
        )}

        {/* Add from file */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-20 h-14 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-white/[0.2] transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 hover:bg-white/[0.045]"
        >
          <span className="text-[14px] text-white/30 font-light leading-none">+</span>
          <span className="text-[9px] text-white/25 font-medium">{t('settings.addFile')}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Add from URL */}
        <button
          onClick={() => setShowUrlInput(!showUrlInput)}
          className={`w-20 h-14 rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
            showUrlInput
              ? 'border-white/[0.2] bg-white/[0.075]'
              : 'border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.045]'
          }`}
        >
          <Link size={12} className="text-white/30" />
          <span className="text-[9px] text-white/25 font-medium">URL</span>
        </button>
      </div>

      {/* URL download input */}
      {showUrlInput && (
        <div className="flex gap-2 animate-fade-in-up">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDownloadUrl()}
            placeholder={t('settings.bgUrlPlaceholder')}
            className="liquid-surface flex-1 rounded-[18px] px-4 py-2.5 text-[13px] text-white/84 outline-none transition-all duration-200 placeholder:text-white/28 focus:border-white/[0.20]"
            autoFocus
          />
          <button
            onClick={handleDownloadUrl}
            disabled={downloading || !urlInput.trim()}
            className="px-4 py-2.5 rounded-[18px] text-[12px] font-semibold bg-white/[0.08] text-white/70 hover:bg-white/[0.12] border border-white/[0.12] transition-all disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
          >
            {downloading ? <Loader2 size={14} className="animate-spin" /> : t('settings.download')}
          </button>
        </div>
      )}
    </div>
  );
});

/* ── Theme Section ──────────────────────────────────────── */

const THEME_PRESET_KEYS = ['soundcloud', 'dark', 'neon', 'forest', 'crimson'] as const;

const ThemeSection = React.memo(function ThemeSection() {
  const { t } = useTranslation();
  const accentColor = useSettingsStore((s) => s.accentColor);
  const themePreset = useSettingsStore((s) => s.themePreset);
  const backgroundImage = useSettingsStore((s) => s.backgroundImage);
  const backgroundOpacity = useSettingsStore((s) => s.backgroundOpacity);
  const backgroundBlur = useSettingsStore((s) => s.backgroundBlur);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setThemePreset = useSettingsStore((s) => s.setThemePreset);
  const setBackgroundOpacity = useSettingsStore((s) => s.setBackgroundOpacity);
  const setBackgroundBlur = useSettingsStore((s) => s.setBackgroundBlur);
  const resetTheme = useSettingsStore((s) => s.resetTheme);

  const colorInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="liquid-panel rounded-[30px] p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-white/80 tracking-tight">
          {t('settings.appearance')}
        </h3>
        <button
          onClick={resetTheme}
          className="text-[12px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
        >
          {t('settings.resetDefaults')}
        </button>
      </div>

      {/* Theme Presets */}
      <div className="space-y-3">
        <label className="text-[13px] text-white/50 font-medium">{t('settings.themePreset')}</label>
        <div className="grid grid-cols-3 gap-3">
          {THEME_PRESET_KEYS.map((id) => {
            const def = THEME_PRESETS[id];
            const isActive = themePreset === id;
            return (
              <button
                key={id}
                onClick={() => setThemePreset(id)}
                className={`group relative rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
                  isActive
                    ? 'border-white/30 ring-1 ring-white/20'
                    : 'border-white/[0.12] hover:border-white/15'
                }`}
              >
                <div
                  className="relative h-16 overflow-hidden"
                  style={{ backgroundColor: def.preview[1] }}
                >
                  <div
                    className="absolute left-3 top-3 w-5 h-5 rounded-full"
                    style={{ backgroundColor: def.preview[0] }}
                  />
                  <div
                    className="absolute right-3 bottom-2 left-3 h-6 rounded-lg"
                    style={{ backgroundColor: def.preview[2] }}
                  />
                </div>
                <div className="px-3 py-2 bg-white/[0.03] text-center">
                  <span
                    className={`text-[12px] font-medium ${isActive ? 'text-white/90' : 'text-white/50'}`}
                  >
                    {def.name}
                  </span>
                </div>
              </button>
            );
          })}
          <button
            onClick={() => {
              setThemePreset('custom');
              colorInputRef.current?.click();
            }}
            className={`group relative rounded-2xl overflow-hidden border border-dashed transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97] ${
              themePreset === 'custom'
                ? 'border-white/30 bg-white/[0.075]'
                : 'border-white/[0.1] hover:border-white/20'
            }`}
          >
            <div className="h-16 flex items-center justify-center">
              <span className="text-[20px] text-white/30 group-hover:text-white/50 transition-colors">
                +
              </span>
            </div>
            <div className="px-3 py-2 bg-white/[0.045] text-center">
              <span
                className={`text-[12px] font-medium ${themePreset === 'custom' ? 'text-white/90' : 'text-white/40'}`}
              >
                {t('settings.themeCustom')}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Accent Color (for custom) */}
      {themePreset === 'custom' && (
        <div className="space-y-3">
          <label className="text-[13px] text-white/50 font-medium">
            {t('settings.accentColor')}
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                className="w-8 h-8 rounded-full border-2 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 shadow-md"
                style={{
                  backgroundColor: color,
                  borderColor: accentColor === color ? 'white' : 'transparent',
                  boxShadow: accentColor === color ? `0 0 16px ${color}60` : undefined,
                }}
              />
            ))}
            <button
              onClick={() => colorInputRef.current?.click()}
              className="w-8 h-8 rounded-full border-2 border-dashed border-white/20 hover:border-white/40 transition-all cursor-pointer flex items-center justify-center text-white/30 hover:text-white/60 hover:scale-110"
            >
              <span className="text-[11px] font-bold">+</span>
            </button>
          </div>
        </div>
      )}
      <input
        ref={colorInputRef}
        type="color"
        value={accentColor}
        onChange={(e) => setAccentColor(e.target.value)}
        className="sr-only"
      />

      {/* Background Image */}
      <WallpaperPicker />

      {/* Background Darkness */}
      {backgroundImage && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-white/50 font-medium">
              {t('settings.bgOpacity')}
            </label>
            <span className="text-[12px] text-white/30 tabular-nums">
              {Math.round(backgroundOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={backgroundOpacity}
            onChange={(e) => setBackgroundOpacity(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)] h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
          />
        </div>
      )}

      {backgroundImage && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-white/50 font-medium">{t('settings.bgBlur')}</label>
            <span className="text-[12px] text-white/30 tabular-nums">{backgroundBlur}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            step={1}
            value={backgroundBlur}
            onChange={(e) => setBackgroundBlur(Number(e.target.value))}
            className="w-full accent-[var(--color-accent)] h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
          />
        </div>
      )}
    </section>
  );
});

/* ── Audio Device Section ──────────────────────────────── */

interface AudioSink {
  name: string;
  description: string;
  is_default: boolean;
}

const AudioDeviceSection = React.memo(function AudioDeviceSection() {
  const { t } = useTranslation();
  const [sinks, setSinks] = useState<AudioSink[]>([]);
  const [switching, setSwitching] = useState(false);

  const refreshSinks = React.useCallback(() => {
    trackedInvoke<AudioSink[]>('audio_list_devices').then(setSinks).catch(console.error);
  }, []);

  // Refresh on mount + when window regains focus (device may have changed)
  useEffect(() => {
    refreshSinks();
    const onFocus = () => refreshSinks();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshSinks]);

  const handleSwitch = async (sinkName: string) => {
    const current = sinks.find((s) => s.is_default);
    if (switching || current?.name === sinkName) return;
    setSwitching(true);
    try {
      await switchAudioDevice(sinkName, true);
      setSinks((prev) => prev.map((s) => ({ ...s, is_default: s.name === sinkName })));
      toast.success(t('settings.audioDeviceSwitched'));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSwitching(false);
    }
  };

  if (sinks.length === 0) return null;

  return (
    <section className="liquid-panel rounded-[30px] p-6">
      <h3 className="text-[15px] font-bold text-white/80 tracking-tight mb-4">
        {t('settings.audioDevice')}
      </h3>
      <div className="flex gap-2 flex-wrap">
        {sinks.map((sink) => (
          <button
            key={sink.name}
            onClick={() => handleSwitch(sink.name)}
            disabled={switching}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[18px] text-[13px] font-semibold transition-all duration-200 cursor-pointer border ${
              sink.is_default
                ? 'liquid-control text-white/90 border-white/[0.20]'
                : 'text-white/48 border-white/[0.08] hover:bg-white/[0.075] hover:text-white/76'
            } disabled:opacity-50`}
          >
            {sink.description}
          </button>
        ))}
      </div>
    </section>
  );
});

const StartupSection = React.memo(function StartupSection() {
  const { t } = useTranslation();
  const startupPage = useSettingsStore((s) => s.startupPage);
  const setStartupPage = useSettingsStore((s) => s.setStartupPage);

  return (
    <section className="liquid-panel rounded-[30px] p-6 space-y-4">
      <div>
        <h3 className="text-[15px] font-bold text-white/80 tracking-tight">
          {t('settings.startup')}
        </h3>
        <p className="text-[12px] text-white/35 mt-1">{t('settings.startupPageDesc')}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STARTUP_PAGES.map((page) => {
          const active = startupPage === page.id;
          return (
            <button
              key={page.id}
              onClick={() => setStartupPage(page.id)}
              className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 cursor-pointer ${
                active
                  ? 'border-white/[0.16] bg-white/[0.08] text-white/90'
                  : 'border-white/[0.12] bg-white/[0.045] text-white/45 hover:bg-white/[0.05] hover:text-white/70'
              }`}
            >
              <span className="text-[13px] font-semibold">{t(page.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
});

/* ── Playback Section ─────────────────────────────────── */

const PlaybackSection = React.memo(function PlaybackSection() {
  const { t } = useTranslation();
  const floatingComments = useSettingsStore((s) => s.floatingComments);
  const setFloatingComments = useSettingsStore((s) => s.setFloatingComments);
  const lyricsVisualizer = useSettingsStore((s) => s.lyricsVisualizer);
  const setLyricsVisualizer = useSettingsStore((s) => s.setLyricsVisualizer);
  const normalizeVolume = useSettingsStore((s) => s.normalizeVolume);
  const setNormalizeVolume = useSettingsStore((s) => s.setNormalizeVolume);
  const highQualityStreaming = useSettingsStore((s) => s.highQualityStreaming);
  const setHighQualityStreaming = useSettingsStore((s) => s.setHighQualityStreaming);
  const bypassWhitelist = useSettingsStore((s) => s.bypassWhitelist);
  const setBypassWhitelist = useSettingsStore((s) => s.setBypassWhitelist);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { data: isPremium } = useSubscription(isAuthenticated);
  const discordRpcEnabled = useSettingsStore((s) => s.discordRpcEnabled);
  const setDiscordRpcEnabled = useSettingsStore((s) => s.setDiscordRpcEnabled);
  const discordRpcMode = useSettingsStore((s) => s.discordRpcMode);
  const setDiscordRpcMode = useSettingsStore((s) => s.setDiscordRpcMode);
  const discordRpcShowButton = useSettingsStore((s) => s.discordRpcShowButton);
  const setDiscordRpcShowButton = useSettingsStore((s) => s.setDiscordRpcShowButton);
  return (
    <section className="liquid-panel rounded-[30px] p-6 space-y-5">
      <h3 className="text-[15px] font-bold text-white/80 tracking-tight">
        {t('settings.playback')}
      </h3>

      {/* Floating Comments */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-white/70 font-medium">{t('settings.floatingComments')}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{t('settings.floatingCommentsDesc')}</p>
        </div>
        <button
          onClick={() => setFloatingComments(!floatingComments)}
          className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
            floatingComments ? 'bg-accent' : 'bg-white/10'
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
              floatingComments ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
            }`}
          />
        </button>
      </div>

      {/* Lyrics visualizer */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-white/70 font-medium">{t('settings.lyricsVisualizer')}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{t('settings.lyricsVisualizerDesc')}</p>
        </div>
        <button
          type="button"
          onClick={() => setLyricsVisualizer(!lyricsVisualizer)}
          className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
            lyricsVisualizer ? 'bg-accent' : 'bg-white/10'
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
              lyricsVisualizer ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-white/70 font-medium">{t('settings.normalizeVolume')}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{t('settings.normalizeVolumeDesc')}</p>
        </div>
        <button
          onClick={() => setNormalizeVolume(!normalizeVolume)}
          className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
            normalizeVolume ? 'bg-accent' : 'bg-white/10'
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
              normalizeVolume ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-white/70 font-medium">
            {t('settings.highQualityStreaming')}
          </p>
          <p className="text-[11px] text-white/30 mt-0.5">
            {t('settings.highQualityStreamingDesc')}
          </p>
        </div>
        {isPremium ? (
          <button
            onClick={() => setHighQualityStreaming(!highQualityStreaming)}
            className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
              highQualityStreaming ? 'bg-accent' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                highQualityStreaming ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
              }`}
            />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-purple-300/80"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.12))',
                border: '0.5px solid rgba(168,85,247,0.25)',
              }}
            >
              <Star size={10} fill="currentColor" className="text-amber-400" />
              Star
            </span>
            <div className="w-11 h-6 rounded-full bg-white/10 relative opacity-40 cursor-not-allowed">
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md bg-white" />
            </div>
          </div>
        )}
      </div>

      {/* Bypass Whitelists */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] text-white/70 font-medium">{t('settings.bypassWhitelist')}</p>
          <p className="text-[11px] text-white/30 mt-0.5">{t('settings.bypassWhitelistDesc')}</p>
        </div>
        {isPremium ? (
          <button
            onClick={() => setBypassWhitelist(!bypassWhitelist)}
            className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
              bypassWhitelist ? 'bg-accent' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                bypassWhitelist ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
              }`}
            />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-purple-300/80"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.12))',
                border: '0.5px solid rgba(168,85,247,0.25)',
              }}
            >
              <Star size={10} fill="currentColor" className="text-amber-400" />
              Star
            </span>
            <div className="w-11 h-6 rounded-full bg-white/10 relative opacity-40 cursor-not-allowed">
              <div className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full shadow-md bg-white" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/[0.10]" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-white/70 font-medium">{t('settings.discordRpc')}</p>
            <p className="text-[11px] text-white/30 mt-0.5">{t('settings.discordRpcDesc')}</p>
          </div>
          <button
            onClick={() => setDiscordRpcEnabled(!discordRpcEnabled)}
            className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
              discordRpcEnabled ? 'bg-accent' : 'bg-white/10'
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                discordRpcEnabled ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
              }`}
            />
          </button>
        </div>

        {discordRpcEnabled && (
          <>
            <div className="space-y-2">
              <p className="text-[13px] text-white/50 font-medium">
                {t('settings.discordRpcMode')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DISCORD_RPC_MODES.map((mode) => {
                  const active = discordRpcMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => setDiscordRpcMode(mode.id)}
                      className={`rounded-2xl border px-3 py-2.5 text-[12px] font-semibold transition-all duration-200 cursor-pointer ${
                        active
                          ? 'border-white/[0.16] bg-white/[0.08] text-white/90'
                          : 'border-white/[0.12] bg-white/[0.045] text-white/45 hover:bg-white/[0.05] hover:text-white/70'
                      }`}
                    >
                      {t(mode.labelKey)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/70 font-medium">
                  {t('settings.discordRpcButton')}
                </p>
                <p className="text-[11px] text-white/30 mt-0.5">
                  {t('settings.discordRpcButtonDesc')}
                </p>
              </div>
              <button
                onClick={() => setDiscordRpcShowButton(!discordRpcShowButton)}
                className={`w-11 h-6 rounded-full transition-all duration-200 cursor-pointer relative ${
                  discordRpcShowButton ? 'bg-accent' : 'bg-white/10'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200 ${
                    discordRpcShowButton ? 'left-[22px] bg-accent-contrast' : 'left-0.5 bg-white'
                  }`}
                />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
});

/* ── Import Section ──────────────────────────────────────── */

const ImportSection = React.memo(function ImportSection() {
  const { t } = useTranslation();
  const [ymOpen, setYmOpen] = useState(false);

  return (
    <section className="liquid-panel rounded-[30px] p-6">
      <h3 className="text-[15px] font-bold text-white/80 tracking-tight mb-4">
        {t('settings.import')}
      </h3>
      <button
        onClick={() => setYmOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 rounded-[18px] text-[13px] font-semibold liquid-control text-white/78 transition-all duration-300 cursor-pointer"
      >
        {t('settings.importYandex')}
      </button>
      {ymOpen && (
        <React.Suspense fallback={null}>
          <YMImportDialogLazy open={ymOpen} onOpenChange={setYmOpen} />
        </React.Suspense>
      )}
    </section>
  );
});

const YMImportDialogLazy = React.lazy(() => import('../components/music/YMImportDialog'));

/* ── Account Section ────────────────────────────────────── */

const QrLinkSheetLazy = React.lazy(() =>
  import('../components/auth/QrLinkSheet').then((m) => ({ default: m.QrLinkSheet })),
);

const AccountSection = React.memo(function AccountSection() {
  const { t } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <section className="liquid-panel rounded-[30px] p-6">
      <h3 className="text-[15px] font-bold text-white/80 tracking-tight mb-5">
        {t('settings.account')}
      </h3>
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setTransferOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[18px] text-[13px] font-semibold liquid-control text-white/78 transition-all duration-300 cursor-pointer w-fit"
        >
          {t('qrLink.transferSession')}
        </button>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[18px] text-[13px] font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/10 hover:border-red-500/20 transition-all duration-300 cursor-pointer w-fit"
        >
          {t('auth.signOut')}
        </button>
      </div>
      {transferOpen && (
        <React.Suspense fallback={null}>
          <QrLinkSheetLazy open={transferOpen} onOpenChange={setTransferOpen} mode="push" />
        </React.Suspense>
      )}
    </section>
  );
});

/* ── Main ───────────────────────────────────────────────── */

export function Settings() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 pb-4">
      <h1 className="liquid-hero-text text-4xl font-extrabold tracking-tight">
        {t('settings.title')}
      </h1>
      <LanguageSection />
      <CacheSection />
      <ThemeSection />
      <StartupSection />
      <PlaybackSection />
      <AudioDeviceSection />
      <ImportSection />
      <CallProxySection />
      <AccountSection />
    </div>
  );
}
