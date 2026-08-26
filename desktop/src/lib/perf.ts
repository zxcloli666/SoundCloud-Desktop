import { useSettingsStore } from '../stores/settings';

/**
 * Performance modes scale the cost of the liquid-glass design down gracefully.
 * `beauty` is byte-for-byte the original experience; `light` is flat and static
 * but keeps the dark frosted aesthetic via solid tints; `medium` sits between.
 *
 * Two gating surfaces consume this:
 *  - index.css `[data-perf="…"]` rules gate CSS-class effects (named glass panels,
 *    keyframe animations) — see ThemeProvider which writes `documentElement.dataset.perf`.
 *  - components read `usePerfMode()` to gate inline-style blurs, particle counts and
 *    whole decorative subtrees (inline `animation`/`filter` can't be overridden by a class).
 */
export type PerfMode = 'light' | 'medium' | 'beauty';

export const PERF_MODES: PerfMode[] = ['light', 'medium', 'beauty'];

export interface PerfProfile {
  mode: PerfMode;
  /** Scale a backdrop/decorative blur radius (px). `light` → 0 (caller swaps to a solid tint). */
  blur: (beautyPx: number) => number;
  /** Scale a decorative particle/element count. `light` → 0. */
  particles: (beautyCount: number) => number;
  /** Run idle decorative animations (drifts, twinkles, spins, marquees, breathing). */
  idleAnim: boolean;
  /** Mount the full page atmosphere (aurora orbs, star fields, ambient layers). */
  atmosphere: boolean;
  /** Per-element drop-shadow/box-shadow glows on particles (the expensive part of twinkle). */
  glow: boolean;
  /** Mount heavy decorative background blooms (AmbientGlow, BackgroundGlow, per-card halos). */
  bloom: boolean;
}

const PROFILES: Record<PerfMode, Omit<PerfProfile, 'mode'>> = {
  beauty: {
    blur: (px) => px,
    particles: (n) => n,
    idleAnim: true,
    atmosphere: true,
    glow: true,
    bloom: true,
  },
  medium: {
    // The default profile must stay cheap on integrated GPUs. Static gradients
    // preserve the visual hierarchy; live backdrop/particle effects are opt-in
    // through Beauty because they repaint large surfaces during scrolling.
    blur: () => 0,
    particles: () => 0,
    idleAnim: false,
    atmosphere: false,
    glow: false,
    bloom: false,
  },
  light: {
    blur: () => 0,
    particles: () => 0,
    idleAnim: false,
    atmosphere: false,
    glow: false,
    bloom: false,
  },
};

// Stable per-mode profile objects so consumers can use them as memo/effect deps and
// zustand selectors return a referentially-stable value.
const PROFILE_CACHE: Record<PerfMode, PerfProfile> = {
  light: { mode: 'light', ...PROFILES.light },
  medium: { mode: 'medium', ...PROFILES.medium },
  beauty: { mode: 'beauty', ...PROFILES.beauty },
};

export function getPerfProfile(mode: PerfMode): PerfProfile {
  return PROFILE_CACHE[mode] ?? PROFILE_CACHE.beauty;
}

/** React hook: the active performance profile, re-rendering only when the mode changes. */
export function usePerfMode(): PerfProfile {
  return useSettingsStore((s) => getPerfProfile(s.perfMode));
}

/**
 * Global idle-animation gate: a single visibilitychange listener flips
 * `documentElement[data-app-hidden]`, which index.css uses to pause every CSS
 * animation while the window is hidden (the WebView does NOT throttle timers/rAF).
 * Idempotent; call once at startup.
 */
let visibilityGateInstalled = false;

export function setupVisibilityGate(): void {
  if (visibilityGateInstalled || typeof document === 'undefined') return;
  visibilityGateInstalled = true;
  const apply = () => {
    if (document.visibilityState === 'hidden') {
      document.documentElement.setAttribute('data-app-hidden', '1');
    } else {
      document.documentElement.removeAttribute('data-app-hidden');
    }
  };
  apply();
  document.addEventListener('visibilitychange', apply);
}
