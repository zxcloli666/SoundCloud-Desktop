import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Cloud, MessageCircle, Music, SlidersHorizontal, Volume2 } from '../../../lib/icons';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { useVoiceStore } from '../../../lib/voice/store';
import type { SpeakMode } from '../../../lib/voice/types';
import { hasServerVoice } from '../../../lib/voice/voice-ids';
import { Card, RangeSlider, Segmented, Toggle } from '../../settings/primitives';
import { Speaker } from '../icons';
import { VOICES } from '../voices';
import { Block } from './Block';
import { VoiceTile } from './VoiceTile';

const SPEAK_MODES: SpeakMode[] = ['with_music', 'device', 'where_i_listen'];

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

function Slider({
  label,
  value,
  shown,
  children,
}: {
  label: string;
  value: string;
  shown?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-ink-55">{label}</span>
        <span className="font-mono text-[12px] font-semibold tabular-nums text-ink-85">
          {value}
        </span>
      </div>
      {children}
      {shown}
    </div>
  );
}

function DuckMeter({ level }: { level: number }) {
  return (
    <span aria-hidden className="mt-3 flex h-6 items-end gap-[3px]">
      {Array.from({ length: 28 }, (_, i) => {
        const wave = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37));
        const ducked = i >= 9 && i < 21;
        return (
          <span
            key={i}
            className={`h-full flex-1 origin-bottom rounded-[2px] transition-[transform,background-color] duration-500 ease-[var(--ease-apple)] ${ducked ? 'bg-accent' : 'bg-ink/[0.18]'}`}
            style={{ transform: `scaleY(${Math.max(0.08, wave * (ducked ? level : 1))})` }}
          />
        );
      })}
    </span>
  );
}

export function VoicePickerCard() {
  const { t } = useTranslation();
  const speak = useVoiceStore((s) => s.config.speak);
  const duck = useVoiceStore((s) => s.config.duck);
  const patchSpeak = useVoiceStore((s) => s.patchSpeak);
  const patch = useVoiceStore((s) => s.patch);
  const outputs = useVoiceRuntime((s) => s.devices.outputs);

  return (
    <Card title={t('voice.voice.title')} icon={<MessageCircle size={17} />}>
      <div
        role="radiogroup"
        aria-label={t('voice.voice.title')}
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
      >
        {VOICES.map((voice) => (
          <VoiceTile
            key={voice.id}
            voice={voice}
            selected={speak.voice === voice.id}
            onSelect={() => patchSpeak({ voice: voice.id })}
          />
        ))}
      </div>
      <div className="mt-5 divide-y divide-ink/[0.05] border-t border-ink/[0.05] pt-1">
        {hasServerVoice(speak.voice) && (
          <Block
            data-ui="settings-row"
            icon={<Cloud size={14} />}
            title={t('voice.speak.server')}
            desc={t('voice.speak.serverDesc')}
            control={
              <Toggle
                checked={speak.server}
                onChange={() => patchSpeak({ server: !speak.server })}
                label={t('voice.speak.server')}
              />
            }
          />
        )}
        <Block
          data-ui="settings-row"
          icon={<SlidersHorizontal size={14} />}
          title={t('voice.voice.sound')}
        >
          <div className="flex flex-col gap-5 sm:flex-row">
            <Slider label={t('voice.voice.speed')} value={`${speak.speed.toFixed(2)}×`}>
              <RangeSlider
                value={speak.speed}
                min={0.8}
                max={1.3}
                step={0.05}
                onChange={(speed) => patchSpeak({ speed })}
              />
            </Slider>
            <Slider label={t('voice.voice.pitch')} value={signed(speak.pitch)}>
              <RangeSlider
                value={speak.pitch}
                min={-4}
                max={4}
                step={1}
                onChange={(pitch) => patchSpeak({ pitch })}
              />
            </Slider>
          </div>
        </Block>
        <Block data-ui="settings-row" icon={<Speaker size={14} />} title={t('voice.voice.speakOn')}>
          <Segmented
            value={speak.mode}
            options={SPEAK_MODES.map((id) => ({ id, label: t(`voice.voice.speakMode.${id}`) }))}
            onChange={(mode) =>
              patchSpeak({
                mode,
                device:
                  mode === 'device'
                    ? (speak.device ?? outputs.find((o) => o.default)?.id ?? null)
                    : speak.device,
              })
            }
          />
          {speak.mode === 'device' && outputs.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {outputs.map((o) => {
                const on = speak.device === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => patchSpeak({ device: o.id })}
                    className={`cursor-pointer rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition-all duration-200 ${
                      on
                        ? 'border-accent/50 bg-accent/[0.08] text-ink-90'
                        : 'border-ink/[0.06] bg-ink/[0.02] text-ink-45 hover:bg-ink/[0.06] hover:text-ink-70'
                    }`}
                  >
                    {o.name}
                  </button>
                );
              })}
            </div>
          )}
        </Block>
        <Block data-ui="settings-row" icon={<Music size={14} />} title={t('voice.voice.duck')}>
          <Slider
            label={t('voice.voice.duckLabel')}
            value={`${Math.round(duck * 100)}%`}
            shown={<DuckMeter level={duck} />}
          >
            <RangeSlider
              value={duck}
              min={0}
              max={1}
              step={0.05}
              onChange={(next) => patch({ duck: next })}
            />
          </Slider>
        </Block>
        <Block
          data-ui="settings-row"
          icon={<Volume2 size={14} />}
          title={t('voice.voice.replies')}
          control={
            <Toggle
              checked={speak.replies}
              onChange={() => patchSpeak({ replies: !speak.replies })}
              label={t('voice.voice.replies')}
            />
          }
        />
      </div>
    </Card>
  );
}
