import * as Dialog from '@radix-ui/react-dialog';
import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/shallow';
import { getCurrentTime, getDuration, handlePrev, seek } from '../../lib/audio';
import { getWallpaperUrl } from '../../lib/cache';
import { art } from '../../lib/formatters';
import { useLyricsStore } from '../../stores/lyrics';
import { usePlayerStore } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';
import { NowPlayingBar } from './NowPlayingBar';
import { Sidebar } from './Sidebar';
import { Titlebar } from './Titlebar';

const LyricsPanel = lazy(() =>
  import('../music/LyricsPanel').then((module) => ({ default: module.LyricsPanel })),
);
const QueuePanel = lazy(() =>
  import('../music/QueuePanel').then((module) => ({ default: module.QueuePanel })),
);

/* ── Keybinding definitions ────────────────────────────────── */

interface Keybinding {
  key: string;
  label: string;
  group: 'playback' | 'navigation' | 'panels';
  display: string; // what to show in the UI (e.g. "Space", "←", "M")
}

const keybindings: Keybinding[] = [
  { key: ' ', label: 'kb.playPause', group: 'playback', display: 'Space' },
  { key: 'ArrowLeft', label: 'kb.seekBack', group: 'playback', display: '←' },
  { key: 'ArrowRight', label: 'kb.seekForward', group: 'playback', display: '→' },
  { key: 'n', label: 'kb.nextTrack', group: 'playback', display: 'N' },
  { key: 'p', label: 'kb.prevTrack', group: 'playback', display: 'P' },
  { key: 's', label: 'kb.shuffle', group: 'playback', display: 'S' },
  { key: 'r', label: 'kb.repeat', group: 'playback', display: 'R' },
  { key: 'ArrowUp', label: 'kb.volumeUp', group: 'playback', display: '↑' },
  { key: 'ArrowDown', label: 'kb.volumeDown', group: 'playback', display: '↓' },
  { key: 'm', label: 'kb.mute', group: 'playback', display: 'M' },
  { key: '/', label: 'kb.search', group: 'navigation', display: '/' },
  { key: 'Ctrl+K', label: 'kb.search', group: 'navigation', display: isMac() ? '⌘ K' : 'Ctrl K' },
  { key: 'q', label: 'kb.queue', group: 'panels', display: 'Q' },
  { key: 'l', label: 'kb.lyrics', group: 'panels', display: 'L' },
  { key: '[', label: 'kb.sidebar', group: 'panels', display: '[' },
  { key: 'Escape', label: 'kb.close', group: 'panels', display: 'Esc' },
  { key: 'Ctrl+/', label: 'kb.showBindings', group: 'panels', display: isMac() ? '⌘ /' : 'Ctrl /' },
];

function isMac() {
  return navigator.platform?.startsWith('Mac') || navigator.userAgent.includes('Mac');
}

const groupLabels = {
  playback: 'kb.groupPlayback',
  navigation: 'kb.groupNavigation',
  panels: 'kb.groupPanels',
} as const;

function getVolumeStep(repeatCount: number): number {
  if (repeatCount < 4) return 1;
  if (repeatCount < 10) return 2;
  if (repeatCount < 18) return 4;
  return 8;
}

/* ── Keybindings dialog ───────────────────────────────────── */

const KeyCap = ({ children }: { children: React.ReactNode }) => (
  <kbd className="inline-flex items-center justify-center min-w-[28px] h-[28px] px-1.5 rounded-lg bg-white/[0.08] border border-white/[0.1] text-[12px] font-semibold text-white/70 font-mono shadow-[0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.06)]">
    {children}
  </kbd>
);

const KeybindingsDialog = React.memo(
  ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => {
    const { t } = useTranslation();

    const groups = (['playback', 'navigation', 'panels'] as const).map((g) => ({
      id: g,
      label: groupLabels[g],
      bindings: keybindings.filter((b) => b.group === g),
    }));

    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" />
          <Dialog.Content className="dialog-content fixed z-[80] top-1/2 left-1/2 w-full max-w-[520px] bg-[#1a1a1e]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-7 pt-6 pb-4 border-b border-white/[0.06]">
              <Dialog.Title className="text-[18px] font-bold text-white/90 tracking-tight">
                {t('kb.title')}
              </Dialog.Title>
              <Dialog.Description className="text-[12px] text-white/30 mt-1">
                {isMac() ? '⌘' : 'Ctrl'} + / {t('kb.toToggle')}
              </Dialog.Description>
            </div>

            {/* Body */}
            <div className="px-7 py-5 space-y-6 max-h-[60vh] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.id}>
                  <h3 className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-3">
                    {t(group.label)}
                  </h3>
                  <div className="space-y-1">
                    {group.bindings.map((bind) => (
                      <div
                        key={bind.key}
                        className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-colors"
                      >
                        <span className="text-[13px] text-white/60">{t(bind.label)}</span>
                        <div className="flex items-center gap-1">
                          {bind.display.split(' ').map((part, i) => (
                            <KeyCap key={i}>{part}</KeyCap>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t border-white/[0.06] flex justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="px-5 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-[13px] font-semibold text-white/70 hover:text-white transition-all cursor-pointer"
                >
                  {t('kb.close')}
                </button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  },
);

/* ── Backgrounds ───────────────────────────────────────────── */

const CustomBackground = React.memo(() => {
  const { bgName, bgOpacity, bgBlur } = useSettingsStore(
    useShallow((s) => ({
      bgName: s.backgroundImage,
      bgOpacity: s.backgroundOpacity,
      bgBlur: s.backgroundBlur,
    })),
  );

  const bgUrl = bgName ? getWallpaperUrl(bgName) : null;
  if (!bgUrl) return null;
  const blurInset = Math.max(24, bgBlur * 2);
  const blurScale = 1 + bgBlur / 160;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute transition-[filter,transform] duration-500 ease-out"
        style={{
          inset: -blurInset,
          contain: 'paint',
          transform: 'translateZ(0)',
          willChange: 'filter',
        }}
      >
        <img
          src={bgUrl}
          alt=""
          aria-hidden="true"
          decoding="async"
          className="w-full h-full object-cover select-none"
          style={{
            opacity: 0.18,
            filter: bgBlur > 0 ? `blur(${bgBlur}px)` : 'none',
            transform: `translateZ(0) scale(${blurScale})`,
            transformOrigin: 'center',
          }}
        />
      </div>
      <div
        className="absolute inset-0 bg-[rgb(8,8,10)] transition-opacity duration-300"
        style={{ opacity: bgOpacity }}
      />
    </div>
  );
});

const AmbientGlow = React.memo(() => {
  const artwork = usePlayerStore((s) => art(s.currentTrack?.artwork_url, 't500x500'));
  if (!artwork) return null;
  return (
    <div
      className="absolute bottom-0 left-0 right-0 h-[400px] opacity-[0.06] blur-[100px] pointer-events-none transition-all duration-[2s] ease-out"
      style={{
        backgroundImage: `url(${artwork})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
    />
  );
});

const StableOutlet = React.memo(() => <Outlet />);

/* ── Helpers ───────────────────────────────────────────────── */

const isInputEl = (el: EventTarget | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLElement && el.isContentEditable);

/* ── AppShell ──────────────────────────────────────────────── */

export const AppShell = React.memo(() => {
  const [queueOpen, setQueueOpen] = useState(false);
  const [kbOpen, setKbOpen] = useState(false);
  const lyricsOpen = useLyricsStore((s) => s.open);
  const volumeHoldRef = useRef<{ key: string | null; repeatCount: number; lastAt: number }>({
    key: null,
    repeatCount: 0,
    lastAt: 0,
  });
  const onQueueToggle = useCallback(() => setQueueOpen((v) => !v), []);
  const onQueueClose = useCallback(() => setQueueOpen(false), []);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = isInputEl(e.target);
      // e.code = physical key (layout-independent), e.key = character
      const code = e.code;

      // Ctrl+/ — toggle keybindings dialog (always)
      if ((e.key === '/' || code === 'Slash') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setKbOpen((v) => !v);
        return;
      }

      // Ctrl+K — focus search (always, even in input)
      if (code === 'KeyK' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        navigate('/search');
        return;
      }

      // / — focus search (not in input)
      if ((e.key === '/' || code === 'Slash') && !inInput) {
        e.preventDefault();
        navigate('/search');
        return;
      }

      if (inInput) return;

      const player = usePlayerStore.getState();

      switch (code) {
        case 'Space':
          e.preventDefault();
          player.togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(Math.min(getCurrentTime() + 5, getDuration()));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(Math.max(getCurrentTime() - 5, 0));
          break;
        case 'ArrowUp':
        case 'ArrowDown': {
          e.preventDefault();
          const now = performance.now();
          const hold = volumeHoldRef.current;
          const sameKeyHold = e.repeat && hold.key === code && now - hold.lastAt < 250;
          const repeatCount = sameKeyHold ? hold.repeatCount + 1 : 0;
          volumeHoldRef.current = {
            key: code,
            repeatCount,
            lastAt: now,
          };

          const direction = code === 'ArrowUp' ? 1 : -1;
          const step = getVolumeStep(repeatCount);
          player.setVolume(usePlayerStore.getState().volume + direction * step);
          break;
        }
        case 'KeyM': {
          const { volume, volumeBeforeMute } = usePlayerStore.getState();
          player.setVolume(volume > 0 ? 0 : volumeBeforeMute);
          break;
        }
        case 'KeyN':
          player.next();
          break;
        case 'KeyP':
          handlePrev();
          break;
        case 'KeyS':
          player.toggleShuffle();
          break;
        case 'KeyR':
          player.toggleRepeat();
          break;
        case 'KeyL':
          useLyricsStore.getState().toggle();
          break;
        case 'KeyQ':
          setQueueOpen((v) => !v);
          break;
        case 'BracketLeft':
          useSettingsStore.getState().toggleSidebar();
          break;
        case 'Escape':
          if (kbOpen) {
            setKbOpen(false);
            break;
          }
          if (useLyricsStore.getState().open) useLyricsStore.getState().close();
          else if (queueOpen) setQueueOpen(false);
          break;
      }
    };

    const resetVolumeHold = (e: KeyboardEvent) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        volumeHoldRef.current = { key: null, repeatCount: 0, lastAt: 0 };
      }
    };

    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', resetVolumeHold);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', resetVolumeHold);
    };
  }, [navigate, queueOpen, kbOpen]);

  return (
    <div className="flex flex-col h-screen relative overflow-hidden">
      <CustomBackground />
      <AmbientGlow />
      <Titlebar />
      <div className="flex flex-1 min-h-0 relative z-10" style={{ isolation: 'isolate' }}>
        <Sidebar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <StableOutlet />
        </main>
      </div>
      <NowPlayingBar onQueueToggle={onQueueToggle} queueOpen={queueOpen} />
      {queueOpen && (
        <Suspense fallback={null}>
          <QueuePanel open={queueOpen} onClose={onQueueClose} />
        </Suspense>
      )}
      {lyricsOpen && (
        <Suspense fallback={null}>
          <LyricsPanel />
        </Suspense>
      )}
      <KeybindingsDialog open={kbOpen} onOpenChange={setKbOpen} />
    </div>
  );
});
