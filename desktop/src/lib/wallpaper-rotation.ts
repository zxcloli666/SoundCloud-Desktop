import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';
import { useSettingsStore, type WallpaperRotationOrder } from '../stores/settings';
import { listWallpapers } from './cache';

export const ROTATION_MINUTES = [1, 5, 15, 30, 60] as const;

export function pickNextWallpaper(
  names: readonly string[],
  current: string,
  order: WallpaperRotationOrder,
  random: () => number = Math.random,
): string | null {
  if (names.length === 0) return null;
  const index = names.indexOf(current);
  if (index < 0) return names[0];
  if (names.length === 1) return current;
  if (order === 'shuffle') {
    const offset = 1 + Math.floor(random() * (names.length - 1));
    return names[(index + offset) % names.length];
  }
  return names[(index + 1) % names.length];
}

export function advanceWallpaper(): void {
  const s = useSettingsStore.getState();
  const next = pickNextWallpaper(
    s.wallpaperRotationNames,
    s.backgroundImage,
    s.wallpaperRotationOrder,
  );
  if (next && next !== s.backgroundImage) s.setBackgroundImage(next);
}

export function useWallpaperRotation(): void {
  const { enabled, names, minutes, current } = useSettingsStore(
    useShallow((s) => ({
      enabled: s.wallpaperRotation,
      names: s.wallpaperRotationNames,
      minutes: s.wallpaperRotationMinutes,
      current: s.backgroundImage,
    })),
  );

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    listWallpapers().then((saved) => {
      if (cancelled || saved.length === 0) return;
      const s = useSettingsStore.getState();
      const kept = s.wallpaperRotationNames.filter((n) => saved.includes(n));
      if (kept.length !== s.wallpaperRotationNames.length) s.setWallpaperRotationNames(kept);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (enabled && names.length > 0 && !names.includes(current)) {
      useSettingsStore.getState().setBackgroundImage(names[0]);
    }
  }, [enabled, names, current]);

  const active = enabled && names.length > 1;

  useEffect(() => {
    if (!active || !current) return;
    const dueAt = Date.now() + minutes * 60_000;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'hidden') return;
      timer = setTimeout(advanceWallpaper, Math.max(0, dueAt - Date.now()));
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [active, minutes, current]);
}
