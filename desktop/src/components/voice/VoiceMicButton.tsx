import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../../lib/premium-cache';
import { toggleListening } from '../../lib/voice/listen';
import { useVoiceRuntime } from '../../lib/voice/runtime';
import { useVoiceStore } from '../../lib/voice/store';
import { Mic } from './icons';
import { useLevelDrive } from './useLevelDrive';

export const VoiceMicButton = memo(function VoiceMicButton({
  className,
}: {
  className: (active: boolean) => string;
}) {
  const { t } = useTranslation();
  const premium = usePremium();
  const enabled = useVoiceStore((s) => s.config.enabled);
  const engine = useVoiceRuntime((s) => s.engine);
  const ref = useRef<HTMLButtonElement>(null);
  const listening = engine === 'listening';
  const busy = engine === 'thinking';
  useLevelDrive(ref, null, listening);
  if (!premium || !enabled) return null;
  const label = listening ? t('voice.hud.stop') : t('voice.mic.talk');

  return (
    <button
      ref={ref}
      type="button"
      data-ui="voice-mic"
      title={label}
      aria-label={label}
      aria-pressed={listening}
      onClick={() => toggleListening('button')}
      className={`relative ${className(listening || busy)}`}
    >
      {listening && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full bg-accent/25"
          style={{
            transform: 'scale(calc(1 + var(--lvl, 0) * 0.55))',
            transition: 'transform 90ms linear',
          }}
        />
      )}
      {busy && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full motion-reduce:animate-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, var(--color-accent) 120deg, transparent 220deg)',
            WebkitMask:
              'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            mask: 'radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))',
            animation: 'vx-spin 1s linear infinite',
          }}
        />
      )}
      <Mic size={16} className="relative" />
    </button>
  );
});
