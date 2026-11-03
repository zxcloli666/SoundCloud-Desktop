import {useCallback, useMemo, useState} from 'react';
import {type ArchiveShelf, ArchiveStation} from '../components/home/river/ArchiveStation';
import {RIVER_KEYFRAMES} from '../components/home/river/keyframes';
import {RiverFlow} from '../components/home/river/RiverFlow';
import {RiverMasthead} from '../components/home/river/RiverMasthead';
import {WaveFrame} from '../components/home/WaveFrame';
import {useSoundprint} from '../components/library/useSoundprint';
import {SoundWaveLockOverlay} from '../components/music/soundwave';
import {ReleasesShelf} from '../components/releases/ReleasesShelf';
import {useLikedTracks} from '../lib/hooks';
import type {LayoutId} from '../lib/layout';
import {useVisibleBlocks} from '../lib/use-layout';
import {useAuthStore} from '../stores/auth';

type HomeGroup =
  | { kind: 'river' }
  | { kind: 'releases' }
  | { kind: 'archive'; shelves: ArchiveShelf[] };

function groupBlocks(blocks: LayoutId<'home'>[]): HomeGroup[] {
  const groups: HomeGroup[] = [];
  for (const id of blocks) {
    const last = groups[groups.length - 1];
    if (id === 'river') groups.push({ kind: 'river' });
    else if (id === 'releases') groups.push({ kind: 'releases' });
    else if (last?.kind === 'archive') last.shelves.push(id);
    else groups.push({ kind: 'archive', shelves: [id] });
  }
  return groups;
}

/** Главная — «Течение»: река твоей музыки. Устье (играющее + waveform-вода),
 *  русло «Волны» и притоки вдоль нити течения; внизу — затоны (архив). */
export function Home() {
  const user = useAuthStore((s) => s.user);
  const likedTracksQuery = useLikedTracks(100);
  const blocks = useVisibleBlocks('home');
  const groups = useMemo(() => groupBlocks(blocks), [blocks]);

  // Выбранный жанр спектра ретинтит всю страницу (атмосфера + шапка).
  const [genre, setGenre] = useState<string | null>(null);
  const sound = useSoundprint(likedTracksQuery.tracks, genre);

  const likedShelfTracks = useMemo(
    () => likedTracksQuery.tracks.slice(0, 50),
    [likedTracksQuery.tracks],
  );

  const { refetch: refetchLiked } = likedTracksQuery;
  const retryLiked = useCallback(() => void refetchLiked(), [refetchLiked]);

  return (
    <WaveFrame sound={sound}>
      <style>{RIVER_KEYFRAMES}</style>
      {user && <RiverMasthead user={user} sound={sound} selected={genre} onSelect={setGenre} />}

      {groups.map((group, i) =>
        group.kind === 'releases' ? (
          <div key="releases" className={i > 0 ? 'mt-14' : ''}>
            <ReleasesShelf />
          </div>
        ) : group.kind === 'river' ? (
          <div key="river" className={`relative ${i > 0 ? 'mt-14' : ''}`}>
            <RiverFlow tint={sound.tint} />
            <SoundWaveLockOverlay />
          </div>
        ) : (
          <ArchiveStation
            key={group.shelves.join()}
            shelves={group.shelves}
            titled={groups.findIndex((g) => g.kind === 'archive') === i}
            likedTracks={likedShelfTracks}
            likedLoading={likedTracksQuery.isLoading}
            likedFailed={likedTracksQuery.isError && likedShelfTracks.length === 0}
            onRetryLiked={retryLiked}
          />
        ),
      )}
    </WaveFrame>
  );
}
