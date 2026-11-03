import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import type { HeadsetGesture } from '../../../lib/voice/types';
import { SmallButton } from './Block';

const TEST_MS = 15_000;

export function HeadsetTester({ gesture }: { gesture: Exclude<HeadsetGesture, 'off'> }) {
  const { t } = useTranslation();
  const headsetAt = useVoiceRuntime((s) => s.headsetAt);
  const [since, setSince] = useState<number | null>(null);
  const presses = gesture === 'double' ? 2 : 3;
  const passed = since !== null && headsetAt > since;

  useEffect(() => {
    if (since === null || passed) return;
    const timer = setTimeout(() => setSince(null), TEST_MS);
    return () => clearTimeout(timer);
  }, [since, passed]);

  if (passed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-ok/25 bg-ok/[0.08] px-3.5 py-2.5">
        <span
          className="flex size-7 items-center justify-center rounded-full bg-ok text-paper motion-reduce:animate-none"
          style={{ animation: 'vx-flash 520ms var(--ease-apple) both' }}
        >
          <Check size={14} strokeWidth={3} />
        </span>
        <span className="flex-1 text-[12.5px] font-semibold text-ok">
          {t('voice.activation.headsetWorks')}
        </span>
        <SmallButton onClick={() => setSince(Date.now())}>
          {t('voice.activation.again')}
        </SmallButton>
      </div>
    );
  }

  if (since !== null) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.06] px-3.5 py-2.5">
        <span aria-hidden className="flex items-center gap-1.5">
          {Array.from({ length: presses }, (_, i) => (
            <span
              key={i}
              className="size-2.5 rounded-full bg-accent motion-reduce:animate-none"
              style={{ animation: `vx-wait 1.2s ease-in-out ${i * 0.18}s infinite` }}
            />
          ))}
        </span>
        <span className="flex-1 text-[12.5px] font-semibold text-ink-85">
          {t('voice.activation.pressNow', { count: presses })}
        </span>
        <SmallButton onClick={() => setSince(null)}>{t('voice.activation.stopTest')}</SmallButton>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="flex items-center gap-1">
        {Array.from({ length: presses }, (_, i) => (
          <span key={i} className="size-2 rounded-full bg-ink/20" />
        ))}
      </span>
      <span className="flex-1 text-[12px] text-ink-45">
        {t('voice.activation.headsetHow', { count: presses })}
      </span>
      <SmallButton onClick={() => setSince(Date.now())}>{t('voice.activation.test')}</SmallButton>
    </div>
  );
}
