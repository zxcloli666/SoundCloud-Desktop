import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from '../../../lib/icons';
import { voiceIpc } from '../../../lib/voice/ipc';
import type { HeadsetGesture } from '../../../lib/voice/types';
import { CountdownRing } from '../CountdownRing';
import { Headset } from '../icons';
import { SmallButton } from './Block';

const LEARN_MS = 15_000;
const LEARNED_EVENT = 'voice:headset-learned';

type Bound = Exclude<HeadsetGesture, 'off'>;
type Phase = 'bound' | 'learning' | 'single' | 'learned' | 'missed';

const BOUND: readonly string[] = ['double', 'triple', 'next', 'previous'];

const DOTS: Record<Bound, number> = { double: 2, next: 2, triple: 3, previous: 3 };

const PANEL: Record<Phase, string> = {
  bound: 'border-ink/[0.09] bg-ink/[0.035]',
  learning: 'border-accent/35 bg-accent/[0.07]',
  single: 'border-accent/35 bg-accent/[0.07]',
  learned: 'border-ok/30 bg-ok/[0.08]',
  missed: 'border-ink/[0.09] bg-ink/[0.035]',
};

function Badge({ phase }: { phase: Phase }) {
  if (phase === 'learned') {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ok text-paper"
        style={{ animation: 'vx-flash 520ms var(--ease-apple) both' }}
      >
        <Check size={16} strokeWidth={3} />
      </span>
    );
  }
  if (phase === 'learning' || phase === 'single') {
    return (
      <CountdownRing key={phase} ms={LEARN_MS} size={36}>
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

function Dots({ count, lit }: { count: number; lit: boolean }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full transition-colors duration-300 ${lit ? 'bg-ok' : 'bg-ink/45'}`}
        />
      ))}
    </span>
  );
}

function useLearning(on: boolean, onLearned: (learned: string) => void) {
  useEffect(() => {
    if (!on) return;
    let off: (() => void) | null = null;
    let gone = false;
    void listen<string>(LEARNED_EVENT, (e) => onLearned(e.payload)).then((stop) => {
      if (gone) stop();
      else off = stop;
    });
    void voiceIpc.learnHeadset(true).catch(() => {});
    return () => {
      gone = true;
      off?.();
      void voiceIpc.learnHeadset(false).catch(() => {});
    };
  }, [on, onLearned]);
}

export function HeadsetTester({
  bound,
  onBind,
}: {
  bound: HeadsetGesture;
  onBind: (headset: Bound) => void;
}) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>(bound === 'off' ? 'learning' : 'bound');
  const learning = phase === 'learning' || phase === 'single';

  const bind = useRef(onBind);
  bind.current = onBind;

  const onLearned = useCallback((learned: string) => {
    if (learned === 'single') {
      setPhase('single');
      return;
    }
    if (!BOUND.includes(learned)) return;
    bind.current(learned as Bound);
    setPhase('learned');
  }, []);

  useLearning(learning, onLearned);

  useEffect(() => {
    if (!learning) return;
    const timer = setTimeout(() => setPhase(bound === 'off' ? 'missed' : 'bound'), LEARN_MS);
    return () => clearTimeout(timer);
  }, [learning, bound]);

  const shown = bound === 'off' ? null : bound;
  const title =
    phase === 'learning'
      ? t('voice.activation.learnNow')
      : phase === 'single'
        ? t('voice.activation.learnSingle')
        : phase === 'missed' || !shown
          ? t('voice.activation.learnMissed')
          : t(`voice.activation.bound.${shown}`);

  return (
    <div
      data-ui="voice-headset-tester"
      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors duration-300 ${PANEL[phase]}`}
    >
      <Badge phase={phase} />
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        {shown && !learning && phase !== 'missed' && (
          <Dots count={DOTS[shown]} lit={phase === 'learned'} />
        )}
        <span
          className={`truncate text-[12.5px] font-semibold ${phase === 'learned' ? 'text-ok' : 'text-ink-85'}`}
        >
          {title}
        </span>
      </span>
      {learning ? (
        <SmallButton onClick={() => setPhase(bound === 'off' ? 'missed' : 'bound')}>
          {t('voice.activation.stopTest')}
        </SmallButton>
      ) : (
        <SmallButton onClick={() => setPhase('learning')}>
          {phase === 'missed' ? t('voice.activation.again') : t('voice.activation.rebind')}
        </SmallButton>
      )}
    </div>
  );
}
