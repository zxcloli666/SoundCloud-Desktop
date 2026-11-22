import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { art } from '../../lib/formatters';
import { Loader2, Shuffle, User as UserIcon } from '../../lib/icons';
import { SyncStatusChip } from '../sync/SyncStatusChip';
import { SoundprintBars } from './SoundprintBars';
import { useShuffleLikes } from './useShuffleLikes';
import type { Soundprint } from './useSoundprint';

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

export const SoundPrintMasthead = memo(function SoundPrintMasthead({
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
  const { shuffle, loading } = useShuffleLikes();
  const avatar = art(user.avatar_url, 't300x300');

  return (
    <section className="rounded-2xl border border-ink/[0.08] bg-ink/[0.02] p-5 md:p-7">
      <div className="flex items-center gap-5">
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-full bg-ink/5 ring-1 ring-ink/10 md:h-20 md:w-20">
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" decoding="async" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <UserIcon size={28} className="text-ink-25" />
            </div>
          )}
        </div>
        <div data-ui="greeting" className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-40">
            {t('nav.library')}
          </p>
          <h1 className="break-words text-[24px] font-bold leading-tight tracking-tight text-ink md:text-[30px]">
            {t(greetingKey(), { name: user.username })}
          </h1>
          <SyncStatusChip quietWhenSynced className="mt-2.5" />
        </div>
        <button
          type="button"
          onClick={shuffle}
          disabled={loading}
          className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full bg-accent py-3 pl-4 pr-5 text-[14px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Shuffle size={18} />}
          {t('library.playYourSound')}
        </button>
      </div>

      {sound.hasData && (
        <div className="mt-6 border-t border-ink/[0.08] pt-5">
          <SoundprintBars spectrum={sound.spectrum} selected={selected} onSelect={onSelect} />
        </div>
      )}
    </section>
  );
});
