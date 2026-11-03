import { useTranslation } from 'react-i18next';
import { Play, Sparkles, Star } from '../../../lib/icons';
import { usePerfMode } from '../../../lib/perf';
import { useVoiceRuntime } from '../../../lib/voice/runtime';
import { Card } from '../../settings/primitives';
import { StarCta } from '../../star-moments/StarCta';
import { VoiceAvatar } from '../VoiceAvatar';
import { VOICES } from '../voices';
import { SmallButton } from './Block';
import { playPreview } from './preview';
import { VoiceTile } from './VoiceTile';

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 41 + 7) % 100,
  top: (i * 67 + 13) % 100,
  size: 6 + ((i * 5) % 9),
  delay: (i * 0.37) % 4,
  duration: 4 + (i % 4),
}));

const EXAMPLES = ['play', 'volume', 'like'];

export function VoiceLocked() {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const lolya = VOICES[0];
  const speaking = useVoiceRuntime((s) => s.previewing === lolya.id);
  const blur = perf.blur(40);
  const sparks = SPARKS.slice(0, perf.particles(SPARKS.length));

  return (
    <>
      <section
        data-ui="voice-locked"
        className="relative overflow-hidden rounded-[2rem] p-7 md:p-8"
        style={{
          border: '0.5px solid rgba(168,85,247,0.3)',
          background:
            blur > 0
              ? 'radial-gradient(ellipse 70% 90% at 12% 20%, rgba(168,85,247,0.22), transparent 62%), radial-gradient(ellipse 60% 80% at 95% 100%, rgba(236,72,153,0.14), transparent 60%), linear-gradient(160deg, rgb(var(--ink) / 0.06), rgb(var(--ink) / 0.015))'
              : 'radial-gradient(ellipse 70% 90% at 12% 20%, rgba(168,85,247,0.2), transparent 62%), rgb(var(--surface) / 0.92)',
          backdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
          WebkitBackdropFilter: blur > 0 ? `blur(${blur}px) saturate(1.4)` : undefined,
          boxShadow:
            '0 24px 70px rgb(var(--shade) / calc(0.42 * var(--shade-alpha))), inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ contain: 'strict', transform: 'translateZ(0)' }}
        >
          {sparks.map((s, i) => (
            <span
              key={i}
              className="absolute text-violet-300 motion-reduce:animate-none"
              style={{
                left: `${s.left}%`,
                top: `${s.top}%`,
                opacity: 0.35,
                animation: perf.idleAnim
                  ? `vx-breathe ${s.duration}s ease-in-out ${s.delay}s infinite`
                  : undefined,
              }}
            >
              <Star size={s.size} fill="currentColor" />
            </span>
          ))}
        </div>
        <div
          className="relative flex flex-col items-center gap-7 sm:flex-row"
          style={{ isolation: 'isolate' }}
        >
          <button
            type="button"
            onClick={() => playPreview(lolya.id)}
            aria-label={t('voice.locked.listen')}
            className="group relative shrink-0 cursor-pointer rounded-full transition-transform duration-500 ease-[var(--ease-apple)] hover:scale-[1.03] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60"
          >
            <VoiceAvatar
              voice={lolya}
              name={t('voice.voices.lolya.name')}
              size={128}
              speaking={speaking}
            />
            <span className="absolute -bottom-1 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-ink/[0.12] bg-surface text-ink-85 shadow-lg transition-transform group-hover:scale-110">
              <Play size={14} fill="currentColor" className="translate-x-[1px]" />
            </span>
          </button>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-violet-300"
              style={{
                background: 'rgba(168,85,247,0.14)',
                border: '0.5px solid rgba(168,85,247,0.4)',
              }}
            >
              <Sparkles size={10} className="text-amber-300" />
              {t('voice.locked.badge')}
            </span>
            <h2 className="mt-3 text-[30px] font-black leading-[1.05] tracking-tight text-ink">
              {t('voice.locked.title')}
            </h2>
            <p className="mt-2 text-[13px] text-ink-55">{t('voice.locked.sub')}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {EXAMPLES.map((key) => (
                <span
                  key={key}
                  className="rounded-full border border-ink/[0.1] bg-ink/[0.05] px-3 py-1.5 text-[12px] font-semibold text-ink-75"
                >
                  {t('voice.quote', { text: t(`voice.locked.example.${key}`) })}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
              <StarCta />
              <SmallButton onClick={() => playPreview(lolya.id)}>
                <Play size={11} fill="currentColor" />
                {t('voice.locked.listen')}
              </SmallButton>
            </div>
          </div>
        </div>
      </section>
      <Card title={t('voice.locked.voices')} icon={<Sparkles size={17} />}>
        <div
          role="radiogroup"
          aria-label={t('voice.locked.voices')}
          className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        >
          {VOICES.map((voice) => (
            <VoiceTile key={voice.id} voice={voice} selected={false} locked />
          ))}
        </div>
      </Card>
    </>
  );
}
