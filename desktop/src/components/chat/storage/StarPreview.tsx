import { type CSSProperties, memo, type ReactNode, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HardDrive, Images, Palette, Star } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { StarCta } from '../../star-moments/StarCta';
import { useReducedMotion } from './motion';
import { Panel } from './Panel';
import { QuotaRing } from './QuotaRing';

const GIB = 1073741824;
const DEMO_STEPS = [0.08, 0.27, 0.46, 0.27];

const SAMPLES = [
  { tilt: -8, x: -64, y: 8, hue: 'linear-gradient(150deg, #ffb38a, #ff6a3d 55%, #8a2be2)' },
  { tilt: 5, x: -20, y: -10, hue: 'linear-gradient(160deg, #8ee6ff, #3a7bfd 60%, #1b1464)' },
  { tilt: -3, x: 26, y: 4, hue: 'linear-gradient(140deg, #c8ffb0, #2fbf71 55%, #0b5d3b)' },
  { tilt: 9, x: 70, y: -6, hue: 'linear-gradient(150deg, #ffd6f0, #ff5fa2 55%, #6a1b9a)' },
];

function useDemoUsed(): number {
  const perf = usePerfMode();
  const reduced = useReducedMotion();
  const [step, setStep] = useState(1);
  const live = perf.idleAnim && !reduced;
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setStep((at) => (at + 1) % DEMO_STEPS.length), 2400);
    return () => window.clearInterval(timer);
  }, [live]);
  return Math.round(DEMO_STEPS[live ? step : 1] * GIB);
}

function SampleAlbum() {
  const perf = usePerfMode();
  const reduced = useReducedMotion();
  const float = perf.idleAnim && !reduced;
  return (
    <div className="relative h-[120px] w-[240px]" aria-hidden>
      {SAMPLES.map((sample, index) => (
        <span
          key={sample.hue}
          className="storage-motion absolute top-1/2 left-1/2 size-[76px] rounded-2xl border-2 border-[rgb(var(--surface-hi))]"
          style={
            {
              '--storage-tilt': `${sample.tilt}deg`,
              marginLeft: sample.x - 38,
              marginTop: sample.y - 38,
              background: sample.hue,
              boxShadow: '0 14px 30px -10px rgb(var(--shade) / calc(0.6 * var(--shade-alpha)))',
              transform: `rotate(${sample.tilt}deg)`,
              animation: float
                ? `storage-pop 520ms var(--ease-apple) ${index * 90}ms both, storage-float 5s ease-in-out ${600 + index * 400}ms infinite`
                : `storage-pop 520ms var(--ease-apple) ${index * 90}ms both`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

function Perk({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[13px] font-medium text-ink-80">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-accent/[0.14] text-[var(--color-accent)]">
        {icon}
      </span>
      {text}
    </li>
  );
}

export const StarPreview = memo(function StarPreview() {
  const { t } = useTranslation();
  const used = useDemoUsed();
  return (
    <Panel ui="chat-storage-star" className="p-6 @min-[720px]:p-8">
      <div className="flex flex-col items-center gap-8 @min-[720px]:flex-row @min-[720px]:items-center">
        <div className="relative flex shrink-0 flex-col items-center gap-4">
          <SampleAlbum />
          <QuotaRing used={used} quota={GIB} size={112} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center @min-[720px]:items-start @min-[720px]:text-left">
          <span className="flex items-center gap-1.5 rounded-full bg-accent/[0.14] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-80">
            <Star size={11} fill="currentColor" className="text-[var(--color-accent)]" />
            STAR
          </span>
          <h2 className="text-[22px] font-bold leading-tight tracking-tight text-ink-92">
            {t('chat.storage.star.title')}
          </h2>
          <ul className="flex flex-col gap-2.5">
            <Perk icon={<Images size={14} />} text={t('chat.storage.star.albums')} />
            <Perk icon={<HardDrive size={14} />} text={t('chat.storage.star.quota')} />
            <Perk icon={<Palette size={14} />} text={t('chat.storage.star.rooms')} />
          </ul>
          <StarCta />
        </div>
      </div>
    </Panel>
  );
});
