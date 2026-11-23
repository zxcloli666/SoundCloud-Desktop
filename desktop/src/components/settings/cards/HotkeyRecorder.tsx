import { type KeyboardEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  chordFromEvent,
  chordLabels,
  type KeyChord,
  type Modifier,
  parseAccelerator,
  toAccelerator,
} from '../../../lib/hotkeys/accelerator';
import { suspendGlobalHotkeys } from '../../../lib/hotkeys/runtime';
import { isMac, isWindows } from '../../../lib/platform';
import { KeyCaps } from '../../ui/KeyCap';

const CLEAR_CODES = new Set(['Backspace', 'Delete']);

export function HotkeyRecorder({
  value,
  label,
  validate,
  onChange,
  onProblem,
}: {
  value: string;
  label: string;
  validate: (chord: KeyChord) => string | null;
  onChange: (accelerator: string) => void;
  onProblem: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [held, setHeld] = useState<Modifier[]>([]);
  const mac = isMac();
  const windows = isWindows();

  useEffect(() => {
    if (!recording) return;
    suspendGlobalHotkeys(true);
    return () => suspendGlobalHotkeys(false);
  }, [recording]);

  const stop = () => {
    setRecording(false);
    setHeld([]);
  };

  const start = () => {
    onProblem(null);
    setRecording(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) {
      if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const chord = chordFromEvent(event.nativeEvent);
    if (!chord.code) {
      setHeld(chord.modifiers);
      return;
    }
    const bare = chord.modifiers.length === 0;
    if (bare && chord.code === 'Escape') {
      stop();
      return;
    }
    if (bare && CLEAR_CODES.has(chord.code)) {
      onChange('');
      stop();
      return;
    }
    const problem = validate(chord);
    onProblem(problem);
    if (problem) {
      setHeld([]);
      return;
    }
    onChange(toAccelerator(chord));
    stop();
  };

  const onKeyUp = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return;
    event.preventDefault();
    event.stopPropagation();
    setHeld(chordFromEvent(event.nativeEvent).modifiers);
  };

  const labels = value ? chordLabels(parseAccelerator(value), mac, windows) : [];
  const heldLabels = chordLabels({ modifiers: held, code: null }, mac, windows);

  return (
    <button
      type="button"
      onClick={recording ? undefined : start}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={stop}
      aria-label={t('hotkeys.assign', { action: label })}
      title={recording ? t('hotkeys.recordHint') : t('hotkeys.assign', { action: label })}
      className={`relative flex h-8 min-w-[148px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-2.5 outline-none transition-colors duration-150 ${
        recording
          ? 'border-accent bg-accent/[0.08]'
          : 'border-[color:var(--set-line)] bg-[var(--set-well)] hover:border-[color:var(--shell-line-hi)] hover:bg-[var(--set-well-hi)] focus-visible:border-accent'
      }`}
      style={recording ? { boxShadow: '0 0 0 3px var(--color-accent-glow)' } : undefined}
    >
      {recording ? (
        heldLabels.length > 0 ? (
          <KeyCaps labels={heldLabels} size="sm" active />
        ) : (
          <span className="flex items-center gap-2 text-[12px] font-semibold text-ink-75">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {t('hotkeys.recording')}
          </span>
        )
      ) : labels.length > 0 ? (
        <KeyCaps labels={labels} size="sm" />
      ) : (
        <span className="text-[12px] font-medium text-ink-30">{t('hotkeys.notSet')}</span>
      )}
    </button>
  );
}
