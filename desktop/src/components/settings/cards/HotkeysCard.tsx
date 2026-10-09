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
      <div
        className={`divide-y divide-white/[0.05] transition-opacity duration-300 ${
          enabled ? '' : 'opacity-55'
        }`}
      >
        {GLOBAL_HOTKEY_ACTIONS.map((action) => (
          <HotkeyRow
            key={action}
            icon={ACTION_ICONS[action]}
            label={t(`hotkeys.actions.${action}`)}
            value={hotkeys[action]}
            status={enabled ? statuses[action] : undefined}
            validate={validatorFor(action)}
            onChange={(accelerator) => setHotkey(action, accelerator)}
          />
        ))}
      </div>
      {!enabled && <p className="mt-3 text-[11.5px] text-white/40">{t('hotkeys.offHint')}</p>}
      <div className="mt-4 pt-4 border-t border-white/[0.05] flex items-center gap-3">
        <AudioLines size={14} className="shrink-0 text-white/30" />
        <p className="flex-1 min-w-0 text-[11.5px] leading-snug text-white/40">
          {t('hotkeys.mediaKeys')}
        </p>
        <button
          type="button"
          onClick={resetHotkeys}
          disabled={isDefault}
          className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-white/[0.06] text-white/75 hover:bg-white/[0.1] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 cursor-pointer disabled:opacity-35 disabled:cursor-default disabled:hover:bg-white/[0.06]"
        >
          <RotateCcw size={12} />
          {t('hotkeys.reset')}
        </button>
      </div>
    </Card>
  );
}
