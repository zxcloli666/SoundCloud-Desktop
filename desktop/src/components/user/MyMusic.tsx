import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLikedTracks } from '../../lib/hooks';
import { Compass, Library, Music } from '../../lib/icons';
import { SoundprintBars } from '../library/SoundprintBars';
import { useSoundprint } from '../library/useSoundprint';

const LINKS = [
  { to: '/library', icon: Library, label: 'nav.library' },
  { to: '/discover', icon: Compass, label: 'nav.discover' },
  { to: '/library#soundprint', icon: Music, label: 'library.soundprint' },
] as const;

export function MyMusic() {
  const { t } = useTranslation();
  const [genre, setGenre] = useState<string | null>(null);
  const likes = useLikedTracks(100);
  const sound = useSoundprint(likes.tracks, genre);

  return (
    <section data-ui="my-music" className="panel mt-6 p-4 md:p-5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-45">
          {t('user.myMusic')}
        </h2>
        <nav className="flex flex-wrap gap-2">
          {LINKS.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} className="chip-pill">
              <Icon size={14} aria-hidden="true" />
              {t(label)}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-5 max-w-xl">
        {sound.hasData ? (
          <SoundprintBars spectrum={sound.spectrum} selected={genre} onSelect={setGenre} />
        ) : (
          <p className="text-[12px] text-ink-40">{t('user.myMusicEmpty')}</p>
        )}
      </div>
    </section>
  );
}
