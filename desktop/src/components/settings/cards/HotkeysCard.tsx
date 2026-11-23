import { type ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ChordProblem,
  chordProblem,
  type KeyChord,
  toAccelerator,
} from '../../../lib/hotkeys/accelerator';
import {
  DEFAULT_GLOBAL_HOTKEYS,
  GLOBAL_HOTKEY_ACTIONS,
  type GlobalHotkeyAction,
  withDefaults,
} from '../../../lib/hotkeys/actions';
import { loadHotkeyBackend, useHotkeyRuntime } from '../../../lib/hotkeys/runtime';
import {
  AudioLines,
  FastForward,
  Heart,
  Keyboard,
  Play,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from '../../../lib/icons';
import { isMac, isWindows } from '../../../lib/platform';
import { useSettingsStore } from '../../../stores/settings';
import { Card, Toggle } from '../primitives';
import { HotkeyRow } from './HotkeyRow';
import { WaylandHotkeysHint } from './WaylandHotkeysHint';

const ACTION_ICONS: Record<GlobalHotkeyAction, ReactNode> = {
  playPause: <Play size={14} />,
  next: <SkipForward size={14} />,
  prev: <SkipBack size={14} />,
  volumeUp: <Volume2 size={14} />,
  volumeDown: <Volume1 size={14} />,
  mute: <VolumeX size={14} />,
  like: <Heart size={14} />,
  seekForward: <FastForward size={14} />,
  seekBack: <Rewind size={14} />,
};

function superKeyName(): string {
  if (isMac()) return '⌘';
  return isWindows() ? 'Win' : 'Super';
}

export function HotkeysCard() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((s) => s.globalHotkeysEnabled);
  const stored = useSettingsStore((s) => s.globalHotkeys);
  const setEnabled = useSettingsStore((s) => s.setGlobalHotkeysEnabled);
  const setHotkey = useSettingsStore((s) => s.setGlobalHotkey);
  const resetHotkeys = useSettingsStore((s) => s.resetGlobalHotkeys);
  const backend = useHotkeyRuntime((s) => s.backend);
  const statuses = useHotkeyRuntime((s) => s.statuses);
  const hotkeys = withDefaults(stored);
  const isDefault = GLOBAL_HOTKEY_ACTIONS.every((a) => hotkeys[a] === DEFAULT_GLOBAL_HOTKEYS[a]);

  useEffect(loadHotkeyBackend, []);

  const describeProblem = (problem: ChordProblem) =>
    t(`hotkeys.problem.${problem}`, { super: superKeyName() });

  const validatorFor = (action: GlobalHotkeyAction) => (chord: KeyChord) => {
    const problem = chordProblem(chord);
    if (problem) return describeProblem(problem);
    const accelerator = toAccelerator(chord);
    const owner = GLOBAL_HOTKEY_ACTIONS.find((a) => a !== action && hotkeys[a] === accelerator);
    if (owner) {
      return t('hotkeys.problem.duplicate', { action: t(`hotkeys.actions.${owner}`) });
    }
    return null;
  };

  return (
    <Card
      title={t('hotkeys.title')}
      desc={t('hotkeys.desc')}
      icon={<Keyboard size={17} />}
      action={
        <Toggle
          checked={enabled}
          onChange={() => setEnabled(!enabled)}
          label={t('hotkeys.toggle')}
        />
      }
    >
      {enabled && backend === 'wayland' && <WaylandHotkeysHint />}
      {GLOBAL_HOTKEY_ACTIONS.map((action) => (
        <HotkeyRow
          key={action}
          icon={ACTION_ICONS[action]}
          label={t(`hotkeys.actions.${action}`)}
          value={hotkeys[action]}
          dim={!enabled}
          status={enabled ? statuses[action] : undefined}
          validate={validatorFor(action)}
          onChange={(accelerator) => setHotkey(action, accelerator)}
        />
      ))}
      <div className="set-row flex min-h-[52px] items-center gap-3 py-3">
        <AudioLines size={14} className="shrink-0 text-ink-35" />
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-ink-45">
          {enabled ? t('hotkeys.mediaKeys') : t('hotkeys.offHint')}
        </p>
        <button
          type="button"
          onClick={resetHotkeys}
          disabled={isDefault}
          className="set-btn"
          data-tone="quiet"
        >
          <RotateCcw size={13} />
          {t('hotkeys.reset')}
        </button>
      </div>
    </Card>
  );
}
