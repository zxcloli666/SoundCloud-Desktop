import type { RoomView } from '../../../lib/together/types';
import type { Track } from '../../../stores/player';
import { ROOM_CODE } from './convs';
import { ME_ID, person } from './people';
import { labPicture } from './pictures';

export interface RoomOptions {
  star: boolean;
  host: boolean;
  backdrop?: RoomView['backdrop'];
  roomImages?: RoomView['roomImages'];
  cover?: boolean;
}

function labTrack(): Track {
  return {
    id: 9001,
    urn: 'soundcloud:tracks:9001',
    title: 'Night Drive',
    duration: 214_000,
    artwork_url: null,
    permalink_url: 'https://soundcloud.com/lab/night-drive',
    user: {
      id: 1,
      urn: 'soundcloud:users:1',
      username: 'Kavinsky Echo',
      avatar_url: '',
    },
  };
}

export function labRoomView(options: RoomOptions): RoomView {
  const now = Date.now();
  const ids = [options.host ? ME_ID : 'u-kai', ...['u-mira', 'u-sasha', 'u-danil'], ME_ID];
  const members = [...new Set(ids)].map((id, index) => ({
    userId: id,
    name: person(id).name,
    avatarUrl: person(id).avatarUrl,
    joinedAt: now - (index + 1) * 600_000,
    readyUrn: null,
  }));
  return {
    code: ROOM_CODE,
    hostId: options.host ? ME_ID : 'u-kai',
    version: 1,
    createdAt: now - 3_600_000,
    members,
    playback: {
      status: 'playing',
      track: labTrack(),
      trackUrn: 'soundcloud:tracks:9001',
      positionMs: 42_000,
      at: now,
      rate: 1,
    },
    online: members.map((member) => member.userId),
    serverNow: now,
    public: true,
    title: 'Ночной эфир',
    chatId: 'c-room',
    chatEnabled: true,
    moderators: ['u-mira'],
    muted: [],
    slowModeS: 0,
    links: true,
    banned: [],
    perks: options.star
      ? { starHost: true, capacity: 25, modsMax: 8 }
      : { starHost: false, capacity: 10, modsMax: 3 },
    cover: options.cover ? { url: labPicture('', 'room-cover', 'thumb') ?? '', accent: 3 } : null,
    roomImages: options.roomImages ?? 'members',
    backdrop: options.backdrop ?? null,
    backdropCooldownUntil: null,
  };
}
