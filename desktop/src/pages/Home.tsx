import { useMemo, useState } from 'react';
import { ArchiveStation } from '../components/home/river/ArchiveStation';
import { RIVER_KEYFRAMES } from '../components/home/river/keyframes';
import { RiverFlow } from '../components/home/river/RiverFlow';
import { RiverMasthead } from '../components/home/river/RiverMasthead';
import { WaveFrame } from '../components/home/WaveFrame';
import { useSoundprint } from '../components/library/useSoundprint';
import { useLikedTracks } from '../lib/hooks';
import { useAuthStore } from '../stores/auth';

/** Главная — «Течение»: река твоей музыки. Устье (играющее + waveform-вода),
 *  русло «Волны» и притоки вдоль нити течения; внизу — затоны (архив). */
export function Home() {
  const user = useAuthStore((s) => s.user);
  const likedTracksQuery = useLikedTracks(100);

  // Выбранный жанр спектра ретинтит всю страницу (атмосфера + шапка).
  const [genre, setGenre] = useState<string | null>(null);
  const sound = useSoundprint(likedTracksQuery.tracks, genre);

  const likedShelfTracks = useMemo(
    () => likedTracksQuery.tracks.slice(0, 50),
    [likedTracksQuery.tracks],
  );

  return (
    <WaveFrame sound={sound}>
      <style>{RIVER_KEYFRAMES}</style>
      {user && <RiverMasthead user={user} sound={sound} selected={genre} onSelect={setGenre} />}

      <div className="relative">
        <RiverFlow tint={sound.tint} />
      </div>

      <ArchiveStation likedTracks={likedShelfTracks} likedLoading={likedTracksQuery.isLoading} />
    </WaveFrame>
  );
}
