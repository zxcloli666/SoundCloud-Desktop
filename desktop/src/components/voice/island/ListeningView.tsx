import { useTranslation } from 'react-i18next';
import { Keyboard } from '../../../lib/icons';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import type { VoiceSource } from '../../../lib/voice/types';
import { Headset, Mic, RadioTower, StopSquare, WandSparkles } from '../icons';
import { Orb } from '../Orb';
import { Waveform } from '../Waveform';
import { CloseX, Dots } from './parts';

function SourceIcon({ source }: { source: VoiceSource }) {
  if (source === 'hotkey') return <Keyboard size={10} />;
  if (source === 'headset') return <Headset size={10} />;
  if (source === 'wake') return <WandSparkles size={10} />;
  if (source === 'remote') return <RadioTower size={10} />;
  return <Mic size={10} />;
}

export function ListeningView({
  source,
  thinking,
  onStop,
  onClose,
}: {
  source: VoiceSource;
  thinking: boolean;
  onStop: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const partial = useVoiceRuntime((s) => s.partial);
  return (
    <>
      <span className="relative">
        <Orb
          size={44}
          mode={thinking ? 'thinking' : 'listening'}
          label={t('voice.hud.listening')}
        />
        <span className="absolute -right-0.5 -bottom-0.5 flex size-[18px] items-center justify-center rounded-full border border-ink/[0.12] bg-surface text-ink-60">
          <SourceIcon source={source} />
        </span>
      </span>
      <span className="min-w-0 flex-1">
        {partial ? (
          <span
            className={`block truncate text-[13.5px] font-semibold leading-tight ${thinking ? 'text-ink-55' : 'text-ink-90'}`}
          >
            {partial}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-tight text-ink-55">
            {thinking ? t('voice.hud.thinking') : t('voice.hud.listening')}
            <Dots />
          </span>
        )}
        <span className="mt-1 block h-[20px] overflow-hidden">
          {thinking ? (
            <span
              className="block h-[3px] mt-[9px] w-full rounded-full motion-reduce:animate-none"
              style={{
                background:
                  'linear-gradient(90deg, rgb(var(--ink) / 0.06), var(--color-accent), rgb(var(--ink) / 0.06))',
                backgroundSize: '200% 100%',
                animation: 'vx-shimmer 1.4s linear infinite',
              }}
            />
          ) : (
            <Waveform width={236} height={20} />
          )}
        </span>
      </span>
      {!thinking && (
        <button
          type="button"
          onClick={onStop}
          aria-label={t('voice.hud.stop')}
          title={t('voice.hud.stop')}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent/15 text-accent transition-transform duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          <StopSquare size={12} fill="currentColor" />
        </button>
      )}
      <CloseX onClick={onClose} label={t('voice.hud.cancel')} />
    </>
  );
}
