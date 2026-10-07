import type { TFunction } from 'i18next';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { handlePrev } from '../../lib/audio';
import { art } from '../../lib/formatters';
import {
  Fullscreen,
  ListMusic,
  MicVocal,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from '../../lib/icons';
import { isMac } from '../../lib/platform';
import { getArtistDisplay, getDisplayTitle } from '../../lib/track-display';
import { toggleWindowFullscreen } from '../../lib/window';
import { type ContextMenuEntry, openContextMenu } from '../../stores/context-menu';
import { useLyricsStore } from '../../stores/lyrics';
import { usePlayerStore, VOLUME_DEFAULT } from '../../stores/player';
import { useSettingsStore } from '../../stores/settings';

const ICON = 15;

interface AppMenuActions {
  queueOpen: boolean;
  toggleQueue: () => void;
  showShortcuts: () => void;
}

function allowsNativeMenu(e: MouseEvent) {
  if (e.shiftKey) return true;
  if (
    e.target instanceof Element &&
    e.target.closest('input, textarea, [contenteditable="true"]')
  ) {
    return true;
  }
  return (window.getSelection()?.toString().trim() ?? '') !== '';
}

const NowPlayingHeader = React.memo(() => {
  const { t } = useTranslation();
  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const cover = art(track?.artwork_url, 't67x67');

  return (
    <div className="flex items-center gap-2.5 px-2 pt-1 pb-1.5">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white/[0.05] text-white/30 ring-1 ring-white/[0.08]">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <Music size={14} />
        )}
        {isPlaying && (
          <span className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_6px_var(--color-accent-glow)]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-white/90">
          {track ? getDisplayTitle(track) : t('player.notPlaying')}
        </p>
        {track && (
          <p className="truncate text-[11px] text-white/40">
            {getArtistDisplay(track).primary || track.user?.username}
          </p>
        )}
      </div>
    </div>
  );
});

function repeatLabel(t: TFunction, mode: 'off' | 'one' | 'all') {
  if (mode === 'one') return t('contextMenu.repeatOne');
  if (mode === 'all') return t('contextMenu.repeatAll');
  return t('contextMenu.repeatOff');
}

function buildEntries(t: TFunction, actions: AppMenuActions): ContextMenuEntry[] {
  const player = usePlayerStore.getState();
  const lyricsOpen = useLyricsStore.getState().open;
  const sidebarCollapsed = useSettingsStore.getState().sidebarCollapsed;
  const hasTrack = player.currentTrack !== null;
  const muted = player.volume === 0;
  const mod = isMac() ? '⌘' : 'Ctrl';

  return [
    {
      id: 'play',
      label: player.isPlaying ? t('track.pause') : t('track.play'),
      icon: player.isPlaying ? <Pause size={ICON} /> : <Play size={ICON} />,
      hint: 'Space',
      disabled: !hasTrack,
      onSelect: player.togglePlay,
    },
    {
      id: 'prev',
      label: t('player.previous'),
      icon: <SkipBack size={ICON} />,
      hint: 'P',
      disabled: !hasTrack,
      onSelect: handlePrev,
    },
    {
      id: 'next',
      label: t('player.next'),
      icon: <SkipForward size={ICON} />,
      hint: 'N',
      disabled: !hasTrack,
      onSelect: player.next,
    },
    'separator',
    {
      id: 'shuffle',
      label: t('player.shuffle'),
      icon: <Shuffle size={ICON} />,
      hint: 'S',
      checked: player.shuffle,
      onSelect: player.toggleShuffle,
    },
    {
      id: 'repeat',
      label: repeatLabel(t, player.repeat),
      icon: player.repeat === 'one' ? <Repeat1 size={ICON} /> : <Repeat size={ICON} />,
      hint: 'R',
      checked: player.repeat !== 'off',
      onSelect: player.toggleRepeat,
    },
    'separator',
    {
      id: 'mute',
      label: muted ? t('contextMenu.unmute') : t('contextMenu.mute'),
      icon: muted ? <Volume2 size={ICON} /> : <VolumeX size={ICON} />,
      hint: 'M',
      onSelect: () => player.setVolume(muted ? player.volumeBeforeMute : 0),
    },
    {
      id: 'volume-reset',
      label: t('player.volumeReset'),
      icon: <RotateCcw size={ICON} />,
      hint: `${player.volume}%`,
      disabled: player.volume === VOLUME_DEFAULT,
      onSelect: player.resetVolume,
    },
    'separator',
    {
      id: 'queue',
      label: actions.queueOpen ? t('contextMenu.hideQueue') : t('contextMenu.showQueue'),
      icon: <ListMusic size={ICON} />,
      hint: 'Q',
      onSelect: actions.toggleQueue,
    },
    {
      id: 'lyrics',
      label: lyricsOpen ? t('contextMenu.hideLyrics') : t('contextMenu.showLyrics'),
      icon: <MicVocal size={ICON} />,
      hint: 'L',
      onSelect: useLyricsStore.getState().toggle,
    },
    {
      id: 'sidebar',
      label: sidebarCollapsed ? t('contextMenu.expandSidebar') : t('contextMenu.collapseSidebar'),
      icon: sidebarCollapsed ? <PanelLeftOpen size={ICON} /> : <PanelLeftClose size={ICON} />,
      hint: '[',
      onSelect: useSettingsStore.getState().toggleSidebar,
    },
    {
      id: 'fullscreen',
      label: t('contextMenu.fullscreen'),
      icon: <Fullscreen size={ICON} />,
      hint: 'F11',
      onSelect: () => void toggleWindowFullscreen(),
    },
    'separator',
    {
      id: 'shortcuts',
      label: t('kb.title'),
      hint: `${mod} /`,
      onSelect: actions.showShortcuts,
    },
  ];
}

export function useAppContextMenu(actions: AppMenuActions) {
  const { t } = useTranslation();
  const latest = useRef({ t, actions });
  latest.current = { t, actions };

  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      if (e.defaultPrevented || allowsNativeMenu(e)) return;
      const { t, actions } = latest.current;
      openContextMenu(e, buildEntries(t, actions), <NowPlayingHeader />);
    };
    window.addEventListener('contextmenu', onContextMenu);
    return () => window.removeEventListener('contextmenu', onContextMenu);
  }, []);
}
