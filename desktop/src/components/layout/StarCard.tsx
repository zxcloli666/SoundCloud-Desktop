import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Star } from '../../lib/icons';
import { usePerfMode } from '../../lib/perf';
import { useOpenStar } from '../../lib/star-offer';
import { SOON_DAYS, type StarStatus, useStarLine, useStarStatus } from '../../lib/star-status';

type Tone = 'calm' | 'warn' | 'bad';

const LINE: Record<Tone, string> = {
  calm: 'text-[10.5px] font-medium text-purple-300/90',
  warn: 'text-[11px] font-bold text-amber-400',
  bad: 'text-[11px] font-bold text-bad',
};

const FILL: Record<Tone, string> = {
  calm: 'bg-purple-300',
  warn: 'bg-amber-400',
  bad: 'bg-bad',
};

const EDGE: Record<Tone, string> = {
  calm: 'rgba(168,85,247,0.2)',
  warn: 'color-mix(in srgb, var(--color-amber-400) 45%, transparent)',
  bad: 'rgb(var(--bad) / 0.5)',
};

function toneOf(status: StarStatus | null): Tone {
  if (status?.kind === 'renews') return status.soon ? 'warn' : 'calm';
  if (status?.kind === 'relink') return 'warn';
  if (status?.kind !== 'ends' || status.level === 'calm') return 'calm';
  return status.level === 'urgent' ? 'bad' : 'warn';
}

export const StarCard = memo(function StarCard({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const openStar = useOpenStar();
  const perf = usePerfMode();
  const cardBlur = perf.blur(16);
  const status = useStarStatus();
  const line = useStarLine(status);
  const tone = toneOf(status);
  const ending = status?.kind === 'ends' && status.level !== 'calm' ? status : null;
  const charging = status?.kind === 'renews' && status.soon ? status : null;
  const offer = ending?.canExtend ? (ending.trial ? 'buy' : 'extend') : null;
  const open = () => (offer ? openStar(offer) : navigate('/star'));

  if (collapsed) {
    return (
      <button
        type="button"
        data-ui="star-card"
        data-tone={tone}
        onClick={open}
        title={line ? `${t('star.title')} · ${line}` : t('star.title')}
        className="relative flex items-center justify-center w-full py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105 group"
        style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(168,85,247,0.12))',
          border: `0.5px solid ${EDGE[tone]}`,
        }}
      >
        <span
          className="text-amber-400"
          style={{ filter: 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' }}
        >
          <Star size={16} fill="currentColor" />
        </span>
        <StarParticles />
        {(ending || charging) && (
          <span
            className={`absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[9px] font-black tabular-nums text-paper ${FILL[tone]}`}
          >
            {ending ? ending.days : <RefreshCw size={9} strokeWidth={3} />}
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      data-ui="star-card"
      data-tone={tone}
      onClick={open}
      className="relative flex w-full px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.01] overflow-hidden group"
      style={{
        background:
          'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(168,85,247,0.1), rgba(192,132,252,0.08))',
        backdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
        WebkitBackdropFilter: cardBlur > 0 ? `blur(${cardBlur}px)` : undefined,
        border: `0.5px solid ${EDGE[tone]}`,
        boxShadow: '0 2px 12px rgba(139,92,246,0.12), inset 0 0.5px 0 rgba(255,255,255,0.08)',
      }}
    >
      <StarParticles />
      <div className="relative flex w-full flex-col gap-2" style={{ isolation: 'isolate' }}>
        <div className="flex items-center gap-2.5">
          <span
            className="text-amber-400 shrink-0"
            style={{ filter: 'drop-shadow(0 0 6px rgba(168,85,247,0.5))' }}
          >
            <Star size={16} fill="currentColor" />
          </span>
          <div className="flex min-w-0 flex-col items-start">
            <span className="text-[11px] font-semibold text-ink-90 tracking-wide">
              {t('star.title')}
            </span>
            <span className={`whitespace-nowrap tabular-nums ${LINE[tone]}`}>
              {line ?? t('star.getIt')}
            </span>
            {charging && (
              <span className="text-[9.5px] font-medium text-ink-50">
                {t('star.in', { count: charging.days })}
              </span>
            )}
          </div>
        </div>
        {ending && (
          <span className="h-1 w-full overflow-hidden rounded-full bg-ink/[0.08]">
            <span
              className={`block h-full rounded-full ${FILL[tone]}`}
              style={{ width: `${(ending.days / SOON_DAYS) * 100}%` }}
            />
          </span>
        )}
        {offer && ending?.level === 'urgent' && (
          <span
            className="flex w-full items-center justify-center gap-1.5 rounded-full py-1.5 text-[11px] font-semibold text-accent-contrast"
            style={{
              background: 'linear-gradient(180deg, var(--color-accent-hover), var(--color-accent))',
              boxShadow:
                '0 0 18px -6px var(--color-accent-glow), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}
          >
            <Star size={10} fill="currentColor" />
            {t(offer === 'buy' ? 'starMoments.getStar' : 'starMoments.extend')}
          </span>
        )}
      </div>
    </button>
  );
});

const PARTICLES = Array.from({ length: 12 }, (_, i) => i);

const StarParticles = memo(function StarParticles() {
  const perf = usePerfMode();
  const count = perf.particles(PARTICLES.length);
  if (count === 0) return null;
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ contain: 'strict', transform: 'translateZ(0)' }}
    >
      {PARTICLES.slice(0, count).map((i) => (
        <div
          key={i}
          className="absolute w-[3px] h-[3px] rounded-full"
          style={{
            background: `hsl(${260 + ((i * 20) % 60)}, 80%, ${70 + ((i * 5) % 30)}%)`,
            left: `${10 + ((i * 37) % 80)}%`,
            top: `${10 + ((i * 53) % 80)}%`,
            opacity: 0.4 + (i % 3) * 0.2,
            animation: perf.idleAnim
              ? `star-float ${3 + (i % 3)}s ease-in-out ${(i * 0.4) % 3}s infinite alternate`
              : undefined,
          }}
        />
      ))}
    </div>
  );
});
