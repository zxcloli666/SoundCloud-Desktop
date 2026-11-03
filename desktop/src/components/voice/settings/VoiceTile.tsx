import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Play } from '../../../lib/icons';
import { SPEECH } from '../../../lib/voice/levels';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { StopSquare } from '../icons';
import { VoiceAvatar } from '../VoiceAvatar';
import type { VoiceInfo } from '../voices';
import { Waveform } from '../Waveform';
import { playPreview } from './preview';

function PreviewButton({ id, name }: { id: string; name: string }) {
  const { t } = useTranslation();
  const playing = useVoiceRuntime((s) => s.previewing === id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        playPreview(id);
      }}
      aria-label={playing ? t('voice.voice.stopPreview') : t('voice.voice.preview', { name })}
      title={playing ? t('voice.voice.stopPreview') : t('voice.voice.preview', { name })}
      className={`absolute right-2.5 top-2.5 flex size-8 cursor-pointer items-center justify-center rounded-full border transition-all duration-300 ease-[var(--ease-apple)] hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        playing
          ? 'border-accent/40 bg-accent text-accent-contrast'
          : 'border-ink/[0.1] bg-ink/[0.06] text-ink-70 hover:bg-ink/[0.12]'
      }`}
    >
      {playing ? (
        <StopSquare size={10} fill="currentColor" />
      ) : (
        <Play size={12} fill="currentColor" className="translate-x-[1px]" />
      )}
    </button>
  );
}

export const VoiceTile = memo(function VoiceTile({
  voice,
  selected,
  locked = false,
  onSelect,
}: {
  voice: VoiceInfo;
  selected: boolean;
  locked?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useTranslation();
  const name = t(`voice.voices.${voice.id}.name`);
  const speaking = useVoiceRuntime((s) => s.previewing === voice.id);
  return (
    <div className="relative">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={locked}
        onClick={onSelect}
        className={`group relative flex w-full flex-col items-center gap-2.5 rounded-[1.4rem] border px-3 pb-3.5 pt-5 text-center transition-all duration-500 ease-[var(--ease-apple)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
          selected
            ? 'border-accent/60 bg-accent/[0.07]'
            : 'border-ink/[0.07] bg-ink/[0.025] enabled:hover:-translate-y-0.5 enabled:hover:border-ink/[0.14] enabled:hover:bg-ink/[0.05]'
        } ${locked ? 'cursor-default' : 'cursor-pointer'}`}
        style={
          selected
            ? {
                boxShadow:
                  '0 14px 36px -18px var(--color-accent-glow), inset 0 0 0 0.5px var(--color-accent)',
              }
            : undefined
        }
      >
        {speaking && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[1.4rem] border-2 border-accent/60"
            style={{ animation: 'vx-wait 1.4s ease-in-out infinite' }}
          />
        )}
        <VoiceAvatar voice={voice} size={58} speaking={speaking} />
        <span className="min-w-0">
          <span className="flex items-center justify-center gap-1.5 text-[13.5px] font-bold text-ink-90">
            {name}
            {locked && <Lock size={11} className="text-ink-35" />}
          </span>
          {speaking ? (
            <span className="mt-1.5 flex h-[17px] items-center justify-center">
              <Waveform width={72} height={14} input={SPEECH} />
            </span>
          ) : (
            <span className="mt-1.5 flex flex-wrap justify-center gap-1">
              <span className="rounded-md bg-ink/[0.07] px-1.5 py-[1px] font-mono text-[9.5px] font-bold uppercase tracking-wider text-ink-55">
                {voice.lang}
              </span>
              {voice.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md bg-ink/[0.04] px-1.5 py-[1px] text-[10px] font-medium text-ink-45"
                >
                  {t(`voice.tags.${tag}`)}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
      <PreviewButton id={voice.id} name={name} />
    </div>
  );
});
