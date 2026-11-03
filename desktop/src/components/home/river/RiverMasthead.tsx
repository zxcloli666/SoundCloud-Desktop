import {memo} from 'react';
import {useTranslation} from 'react-i18next';
import {auraRgba} from '../../../lib/aura';
import {art} from '../../../lib/formatters';
import {User as UserIcon} from '../../../lib/icons';
import {usePerfMode} from '../../../lib/perf';
import {usePlayerStore} from '../../../stores/player';
import {SoundprintBars} from '../../library/SoundprintBars';
import type {Soundprint} from '../../library/useSoundprint';
import {VibePortal} from '../../music/soundwave/vibe-portal';

interface MastheadUser {
  username: string;
  avatar_url: string;
}

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 5) return 'library.greetNight';
  if (h < 12) return 'library.greetMorning';
  if (h < 18) return 'library.greetDay';
  return 'library.greetEvening';
}

/** Шапка «Эфира»: позывные станции + приветствие; ниже — спектроанализатор
 *  вкуса (клик по жанру ретинтит страницу) и vibe-портал. Без blur — лёгкая. */
export const RiverMasthead = memo(function RiverMasthead({
  user,
  sound,
  selected,
  onSelect,
}: {
  user: MastheadUser;
  sound: Soundprint;
  selected: string | null;
  onSelect: (genre: string | null) => void;
}) {
  const { t } = useTranslation();
  const perf = usePerfMode();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const avatar = art(user.avatar_url, 't300x300');

  return (
    <header className="pt-2">
      <div className="flex items-start justify-between gap-6">
        <div data-ui="greeting" className="min-w-0">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/[0.12] px-2.5 py-1 text-[9.5px] font-bold tracking-[0.16em] text-ink-70"
              style={{ background: 'rgb(var(--ink) / 0.03)' }}
            >
              <span
                className="riv-anim size-[6px] rounded-full"
                style={{
                  background: 'var(--color-accent)',
                  boxShadow: perf.glow ? '0 0 8px var(--color-accent)' : undefined,
                  animation:
                    isPlaying && perf.idleAnim ? 'riv-pulse 1.6s ease-in-out infinite' : undefined,
                }}
              />
              {t('soundwave.river.live')}
            </span>
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-30">
              {t('soundwave.river.personal')}
            </span>
          </div>
          <h1
            className="break-words text-[26px] font-black leading-[1.05] tracking-tight md:text-[32px]"
            style={{
              backgroundImage: sound.aura.nameGradient,
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            {t(greetingKey(), { name: user.username })}
          </h1>
          <p className="mt-2 text-[13.5px] text-ink-50">{t('soundwave.tagline')}</p>
        </div>

        <div
          className="relative size-16 flex-none overflow-hidden rounded-full"
          style={{
            border: `0.5px solid ${auraRgba(sound.aura, 0.4)}`,
            boxShadow: `0 10px 30px ${sound.accentGlow}`,
          }}
        >
          {avatar ? (
            <img src={avatar} alt="" className="size-full object-cover" decoding="async" />
          ) : (
            <span className="flex size-full items-center justify-center bg-ink/5">
              <UserIcon size={22} className="text-ink-25" />
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col items-stretch gap-4 lg:flex-row">
        {sound.hasData && (
          <div className="min-w-0 flex-1 rounded-2xl border border-ink/[0.07] bg-ink/[0.025] px-5 py-4">
            <SoundprintBars spectrum={sound.spectrum} selected={selected} onSelect={onSelect} />
          </div>
        )}
        <div className="flex w-full flex-none flex-col justify-end lg:w-[360px]">
          <VibePortal />
        </div>
      </div>
    </header>
  );
});
