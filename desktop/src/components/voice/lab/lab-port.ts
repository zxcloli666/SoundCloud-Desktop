import { playerPort } from '../../../lib/voice/player-port';
import type { Entity } from '../../../lib/voice/types';
import type { Track } from '../../../stores/player';
import { usePlayerStore } from '../../../stores/player';

function fakeTrack(entity: Entity, n: number): Track {
  const id = 900_000 + n;
  return {
    id,
    urn: `soundcloud:tracks:${id}`,
    title: entity.kind === 'artist' ? `${entity.name} ${n + 1}` : entity.name,
    duration: 180_000,
    artwork_url: null,
    user: {
      id: 1,
      urn: 'soundcloud:users:1',
      username: entity.artist || entity.name,
      avatar_url: '',
    },
  };
}

export function installLabPort() {
  playerPort.playEntity = async (entity) => {
    const tracks = [0, 1, 2].map((n) => fakeTrack(entity, n));
    usePlayerStore.setState({
      currentTrack: tracks[0],
      queue: tracks,
      queueIndex: 0,
      isPlaying: true,
    });
    return true;
  };
  playerPort.queueEntity = async (entity) => {
    usePlayerStore.getState().addToQueueNext([fakeTrack(entity, 7)]);
    return true;
  };
}
