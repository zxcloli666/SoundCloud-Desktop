import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import { voiceIpc } from '../../../lib/voice/ipc';
import { useVoiceStore } from '../../../lib/voice/store';
import { Mic } from '../icons';
import { useLevelDrive } from '../useLevelDrive';
import { SmallButton } from './Block';

export const TEACH_SAMPLES = 5;

type Phase = 'idle' | 'recording' | 'saving' | 'done' | 'failed';

export function TeachPanel({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const setTaught = useVoiceStore((s) => s.setWakeTaught);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const micRef = useRef<HTMLSpanElement>(null);
  useLevelDrive(micRef, null, phase === 'recording');

  const begin = async () => {
    setPhase('recording');
    try {
      if (count === 0) await voiceIpc.wakeTeach('start');
      await voiceIpc.wakeTeach('sample');
      const next = count + 1;
      setCount(next);
      if (next < TEACH_SAMPLES) {
        setPhase('idle');
        return;
      }
      setPhase('saving');
      await voiceIpc.wakeTeach('finish');
      setTaught(true);
      setPhase('done');
    } catch {
      setPhase('failed');
    }
  };

  const busy = phase === 'recording' || phase === 'saving';

  return (
    <div data-ui="voice-teach" className="rounded-2xl border border-ink/[0.08] bg-shade-20 p-4">
      <div className="flex items-center gap-4">
        <span
          ref={micRef}
          className={`relative flex size-12 shrink-0 items-center justify-center rounded-full ${phase === 'done' ? 'bg-ok text-paper' : busy ? 'bg-accent text-accent-contrast' : 'bg-ink/[0.08] text-ink-60'}`}
        >
          {phase === 'recording' && (
            <span
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent/30"
              style={{
                transform: 'scale(calc(1 + var(--lvl, 0) * 0.7))',
                transition: 'transform 90ms linear',
              }}
            />
          )}
          <span className="relative">
            {phase === 'done' ? <Check size={18} strokeWidth={3} /> : <Mic size={18} />}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink-90">
            {phase === 'done'
              ? t('voice.teach.done')
              : phase === 'failed'
                ? t('voice.teach.failed')
                : phase === 'recording'
                  ? t('voice.teach.speak')
                  : phase === 'saving'
                    ? t('voice.teach.saving')
                    : t('voice.teach.prompt')}
          </p>
          <div
            className="mt-2 flex items-center gap-1.5"
            aria-label={t('voice.teach.progress', { count, total: TEACH_SAMPLES })}
          >
            {Array.from({ length: TEACH_SAMPLES }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${i < count ? 'bg-accent' : i === count && phase === 'recording' ? 'bg-accent/40' : 'bg-ink/[0.1]'}`}
              />
            ))}
          </div>
        </div>
        {phase === 'done' ? (
          <SmallButton onClick={onClose}>{t('common.close')}</SmallButton>
        ) : (
          <SmallButton primary onClick={() => void begin()} disabled={busy}>
            {phase === 'failed'
              ? t('voice.fix.retry')
              : count === 0
                ? t('voice.teach.start')
                : t('voice.teach.next')}
          </SmallButton>
        )}
      </div>
    </div>
  );
}
