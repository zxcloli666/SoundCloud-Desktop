import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type ChordProblem,
  chordProblem,
  type KeyChord,
  toAccelerator,
} from '../../../lib/hotkeys/accelerator';
import { GLOBAL_HOTKEY_ACTIONS, withDefaults } from '../../../lib/hotkeys/actions';
import { Keyboard, MessageCircle, X } from '../../../lib/icons';
import { isMac, isWindows } from '../../../lib/platform';
import { useVoiceStore } from '../../../lib/voice/store';
import { useSettingsStore } from '../../../stores/settings';
import { HotkeyRecorder } from '../../settings/cards/HotkeyRecorder';
import { Card, Segmented, Toggle } from '../../settings/primitives';
import { Ear, Hand, Headset, WandSparkles } from '../icons';
import { Block } from './Block';
import { HeadsetTester } from './HeadsetTester';
import { WakeBlock } from './WakeBlock';

const FOLLOW_AFTER = [0, 5, 10];
const TALK_SILENCE = [10, 20, 40];

function superKeyName(): string {
  if (isMac()) return '⌘';
  return isWindows() ? 'Win' : 'Super';
}

export function ActivationCard() {
  const { t } = useTranslation();
  const activation = useVoiceStore((s) => s.config.activation);
  const patchActivation = useVoiceStore((s) => s.patchActivation);
  const patchWake = useVoiceStore((s) => s.patchWake);
  const follow = useVoiceStore((s) => s.config.follow);
  const patch = useVoiceStore((s) => s.patch);
  const seconds = (n: number) =>
    n === 0 ? t('voice.activation.followOff') : t('voice.activation.seconds', { count: n });
  const globalOn = useSettingsStore((s) => s.globalHotkeysEnabled);
  const globalKeys = withDefaults(useSettingsStore((s) => s.globalHotkeys));
  const [problem, setProblem] = useState<string | null>(null);
  const [binding, setBinding] = useState(false);
  const headsetOn = activation.headset !== 'off' || binding;

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
            <Toggle
              checked={headsetOn}
              onChange={() => {
                setBinding(!headsetOn);
                if (headsetOn) patchActivation({ headset: 'off' });
              }}
              label={t('voice.activation.headset')}
            />
          }
        >
          {headsetOn && (
            <HeadsetTester
              bound={activation.headset}
              onBind={(headset) => {
                setBinding(false);
                patchActivation({ headset });
              }}
            />
          )}
        </Block>
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
        <Block
          data-ui="settings-row"
          icon={<Ear size={14} />}
          title={t('voice.activation.follow')}
          control={
            <div className="w-[196px]">
              <Segmented
                value={String(follow.after)}
                options={FOLLOW_AFTER.map((n) => ({ id: String(n), label: seconds(n) }))}
                onChange={(v) => patch({ follow: { ...follow, after: Number(v) } })}
              />
            </div>
          }
        />
        <Block
          data-ui="settings-row"
          icon={<MessageCircle size={14} />}
          title={t('voice.activation.talk')}
          desc={t('voice.activation.talkHow')}
          control={
            <div className="w-[196px]">
              <Segmented
                value={String(follow.talk)}
                options={TALK_SILENCE.map((n) => ({ id: String(n), label: seconds(n) }))}
                onChange={(v) => patch({ follow: { ...follow, talk: Number(v) } })}
              />
            </div>
          }
        />
      </div>
    </Card>
  );
}
