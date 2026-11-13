import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ChordProblem,
  chordProblem,
  type KeyChord,
  toAccelerator,
} from '../../../lib/hotkeys/accelerator';
import { GLOBAL_HOTKEY_ACTIONS, withDefaults } from '../../../lib/hotkeys/actions';
import { Keyboard, X } from '../../../lib/icons';
import { isMac, isWindows } from '../../../lib/platform';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import type { HeadsetGesture } from '../../../lib/voice/types';
import { useSettingsStore } from '../../../stores/settings';
import { HotkeyRecorder } from '../../settings/cards/HotkeyRecorder';
import { Card, Segmented, Toggle } from '../../settings/primitives';
import { Hand, Headset, WandSparkles } from '../icons';
import { Block } from './Block';
import { HeadsetTester } from './HeadsetTester';
import { WakeBlock } from './WakeBlock';

const GESTURES: HeadsetGesture[] = ['off', 'double', 'triple'];

function superKeyName(): string {
  if (isMac()) return '⌘';
  return isWindows() ? 'Win' : 'Super';
}

export function ActivationCard() {
  const { t } = useTranslation();
  const activation = useVoiceStore((s) => s.config.activation);
  const patchActivation = useVoiceStore((s) => s.patchActivation);
  const patchWake = useVoiceStore((s) => s.patchWake);
  const wakeModel = useVoiceRuntime((s) => s.models.some((m) => m.kind === 'wake'));
  const globalOn = useSettingsStore((s) => s.globalHotkeysEnabled);
  const globalKeys = withDefaults(useSettingsStore((s) => s.globalHotkeys));
  const [problem, setProblem] = useState<string | null>(null);

  const describe = (p: ChordProblem) => t(`hotkeys.problem.${p}`, { super: superKeyName() });

  const validate = (chord: KeyChord) => {
    const p = chordProblem(chord);
    if (p) return describe(p);
    const accelerator = toAccelerator(chord);
    const owner = globalOn
      ? GLOBAL_HOTKEY_ACTIONS.find((a) => globalKeys[a] === accelerator)
      : undefined;
    return owner ? t('hotkeys.problem.duplicate', { action: t(`hotkeys.actions.${owner}`) }) : null;
  };

  return (
    <Card title={t('voice.activation.title')} icon={<Hand size={17} />}>
      <div className="divide-y divide-ink/[0.05]">
        <Block
          data-ui="settings-row"
          icon={<Keyboard size={14} />}
          title={t('voice.activation.hotkey')}
          control={
            <>
              <HotkeyRecorder
                value={activation.hotkey ?? ''}
                label={t('voice.activation.hotkey')}
                validate={validate}
                onChange={(hotkey) => patchActivation({ hotkey: hotkey || null })}
                onProblem={setProblem}
              />
              <button
                type="button"
                onClick={() => patchActivation({ hotkey: null })}
                disabled={!activation.hotkey}
                aria-label={t('hotkeys.clear')}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-35 transition-all duration-200 hover:bg-ink/[0.08] hover:text-ink-80 disabled:pointer-events-none disabled:opacity-0"
              >
                <X size={13} />
              </button>
            </>
          }
        >
          {problem && <p className="mb-2 text-[11.5px] text-amber-300">{problem}</p>}
          <div className="max-w-[340px]">
            <Segmented
              value={activation.hold ? 'hold' : 'tap'}
              options={[
                { id: 'hold', label: t('voice.activation.hold') },
                { id: 'tap', label: t('voice.activation.tap') },
              ]}
              onChange={(v) => patchActivation({ hold: v === 'hold' })}
            />
          </div>
        </Block>
        <Block
          data-ui="settings-row"
          icon={<Headset size={14} />}
          title={t('voice.activation.headset')}
          control={
            <div className="w-[196px]">
              <Segmented
                value={activation.headset}
                options={GESTURES.map((id) => ({ id, label: t(`voice.activation.gesture.${id}`) }))}
                onChange={(headset) => patchActivation({ headset })}
              />
            </div>
          }
        >
          {activation.headset !== 'off' && (
            <HeadsetTester key={activation.headset} gesture={activation.headset} />
          )}
        </Block>
        {wakeModel && (
          <Block
            data-ui="settings-row"
            icon={<WandSparkles size={14} />}
            title={t('voice.activation.wake')}
            control={
              <Toggle
                checked={activation.wake.on}
                onChange={() => patchWake({ on: !activation.wake.on })}
                label={t('voice.activation.wake')}
              />
            }
          >
            {activation.wake.on && <WakeBlock />}
          </Block>
        )}
      </div>
    </Card>
  );
}
