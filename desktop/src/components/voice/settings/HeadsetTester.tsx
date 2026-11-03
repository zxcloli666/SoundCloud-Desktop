import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import type { HeadsetGesture } from '../../../lib/voice/types';
import { CountdownRing } from '../CountdownRing';
import { Headset } from '../icons';
import { SmallButton } from './Block';

const TEST_MS = 15_000;

type Phase = 'idle' | 'waiting' | 'passed';

const PANEL: Record<Phase, string> = {
  idle: 'border-ink/[0.09] bg-ink/[0.035]',
  waiting: 'border-accent/35 bg-accent/[0.07]',
  passed: 'border-ok/30 bg-ok/[0.08]',
};

const DOT: Record<Phase, string> = {
  idle: 'border border-ink/35',
  waiting: 'bg-accent',
  passed: 'bg-ok',
};

function Badge({ phase }: { phase: Phase }) {
  if (phase === 'passed') {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok text-paper"
        style={{ animation: 'vx-flash 520ms var(--ease-apple) both' }}
      >
        <Check size={16} strokeWidth={3} />
      </span>
    );
  }
  if (phase === 'waiting') {
    return (
      <CountdownRing ms={TEST_MS} size={36}>
        <Headset size={15} className="text-accent" />
      </CountdownRing>
    );
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink/[0.07] text-ink-75">
      <Headset size={15} />
    </span>
  );
}

export function HeadsetTester({ gesture }: { gesture: Exclude<HeadsetGesture, 'off'> }) {
  const { t } = useTranslation();
  const headsetAt = useVoiceRuntime((s) => s.headsetAt);
  const [since, setSince] = useState<number | null>(null);
  const presses = gesture === 'double' ? 2 : 3;
  const phase: Phase = since === null ? 'idle' : headsetAt > since ? 'passed' : 'waiting';

  useEffect(() => {
    if (phase !== 'waiting') return;
    const timer = setTimeout(() => setSince(null), TEST_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const title =
    phase === 'passed'
      ? t('voice.activation.headsetWorks')
      : phase === 'waiting'
        ? t('voice.activation.pressNow', { count: presses })
        : t('voice.activation.headsetHow', { count: presses });

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors duration-300 ${PANEL[phase]}`}
    >
      <Badge phase={phase} />
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <span aria-hidden className="flex shrink-0 items-center gap-1.5">
          {Array.from({ length: presses }, (_, i) => (
            <span
              key={i}
              className={`size-2.5 rounded-full transition-colors duration-300 ${DOT[phase]}`}
              style={
                phase === 'waiting'
                  ? { animation: `vx-wait 1.2s ease-in-out ${i * 0.18}s infinite` }
                  : undefined
              }
            />
          ))}
        </span>
        <span
          className={`truncate text-[12.5px] font-semibold ${phase === 'passed' ? 'text-ok' : 'text-ink-85'}`}
        >
          {title}
        </span>
      </span>
      {phase === 'waiting' ? (
        <SmallButton onClick={() => setSince(null)}>{t('voice.activation.stopTest')}</SmallButton>
      ) : (
        <SmallButton onClick={() => setSince(Date.now())}>
          {phase === 'passed' ? t('voice.activation.again') : t('voice.activation.test')}
        </SmallButton>
      )}
    </div>
  );
}
