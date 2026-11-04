import i18n from '../../../../i18n';
import type { RoomPreview } from '../../../../lib/chat/types';
import { setIsPremium } from '../../../../lib/premium-cache';
import { queryClient } from '../../../../lib/query-client';
import { roomsApi } from '../../../../lib/together/api';
import type { OpenRoom, RoomPerks, RoomView } from '../../../../lib/together/types';
import { useAuthStore } from '../../../../stores/auth';
import { useTogetherStore } from '../../../../stores/together';
import { CONV } from '../convs';
import { isHybrid } from '../ipc';
import { ME_ID, person } from '../people';
import { sleep, waitUntil } from '../steps';
import type { LabKit, LabScene } from '../types';

const STAR: RoomPerks = { starHost: true, capacity: 25, modsMax: 8 };
const FREE: RoomPerks = { starHost: false, capacity: 10, modsMax: 3 };
const ART = (n: number) => `https://i1.sndcdn.com/artworks-perks-lab-${n}-large.jpg`;
const CROWD = ['u-mira', 'u-sasha', 'u-danil', 'u-kai', 'u-lena', 'u-tim'];

function patchRoom(patch: Partial<RoomView>) {
  const room = useTogetherStore.getState().room;
  if (!room) return;
  const online = patch.members ? patch.members.map((member) => member.userId) : room.online;
  useTogetherStore.setState({ room: { ...room, online, ...patch } });
}

function crowd(size: number): RoomView['members'] {
  const now = Date.now();
  return Array.from({ length: size }, (_, index) => {
    const id = index === 0 ? ME_ID : (CROWD[index - 1] ?? `u-guest-${index}`);
    return {
      userId: id,
      name: person(id).name,
      avatarUrl: person(id).avatarUrl,
      joinedAt: now - (size - index) * 60_000,
      readyUrn: null,
    };
  });
}

function hostRoom(kit: LabKit, perks: RoomPerks, patch: Partial<RoomView> = {}) {
  kit.star(perks.starHost);
  setIsPremium(perks.starHost);
  kit.room({ star: perks.starHost, host: true });
  patchRoom({ perks, cover: null, ...patch });
}

const LAB_USER_URN = 'soundcloud:users:7001';

function seedArtwork() {
  if (isHybrid()) return;
  const urn = useAuthStore.getState().user?.urn ?? LAB_USER_URN;
  const page = <T,>(collection: T[]) => ({
    pages: [{ collection, has_more: false, page: 0 }],
    pageParams: [0],
  });
  const tracks = page(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
      urn: `soundcloud:tracks:${n}`,
      title: `Track ${n}`,
      artwork_url: ART(n),
    })),
  );
  queryClient.setQueryData(['user', urn, 'tracks'], tracks);
  queryClient.setQueryData(['user', LAB_USER_URN, 'tracks'], tracks);
  queryClient.setQueryData(
    ['me', 'playlists', 30],
    page(
      [9, 10, 11].map((n) => ({
        urn: `soundcloud:playlists:${n}`,
        title: `Mix ${n}`,
        artwork_url: ART(n),
      })),
    ),
  );
}

async function pressText(text: string) {
  const find = () =>
    [...document.querySelectorAll('button')].find((button) => button.textContent?.includes(text)) ??
    null;
  await waitUntil(() => find() !== null);
  find()?.click();
  await sleep(250);
}

function openRules(kit: LabKit) {
  kit.click('[data-ui="room-rules"]');
  kit.waitFor('[data-ui="room-images-policy"]');
}

function openCover(kit: LabKit) {
  openRules(kit);
  kit.click('[data-ui="room-cover"]');
  kit.waitFor('[data-ui="room-cover-picker"]');
}

const LISTING: OpenRoom[] = [
  {
    hostId: 'u-kai',
    hostName: 'Kai',
    hostAvatarUrl: person('u-kai').avatarUrl,
    status: 'playing',
    track: { title: 'Night Drive', artist: 'Kavinsky Echo', artworkUrl: null },
    listeners: 18,
    capacity: 25,
    full: false,
    starHost: true,
    cover: { url: ART(11), accent: 6 },
    backdrop: { kind: 'preset', id: 'aurora' },
    createdAt: Date.now() - 3_600_000,
  },
  {
    hostId: 'u-mira',
    hostName: 'Mira',
    hostAvatarUrl: person('u-mira').avatarUrl,
    status: 'playing',
    track: { title: 'Road Mix', artist: 'Данил', artworkUrl: null },
    listeners: 25,
    capacity: 25,
    full: true,
    starHost: true,
    cover: { url: ART(12), accent: 3 },
    backdrop: null,
    createdAt: Date.now() - 1_800_000,
  },
  {
    hostId: 'u-lena',
    hostName: 'Лена',
    hostAvatarUrl: person('u-lena').avatarUrl,
    status: 'paused',
    track: { title: 'Lo-fi Morning', artist: 'Tim Bass', artworkUrl: null },
    listeners: 4,
    capacity: 10,
    full: false,
    starHost: false,
    cover: null,
    backdrop: null,
    createdAt: Date.now() - 900_000,
  },
  {
    hostId: 'u-tim',
    hostName: 'Tim Bass',
    hostAvatarUrl: person('u-tim').avatarUrl,
    status: 'playing',
    track: { title: 'Deep Cuts', artist: 'Саша Orbit', artworkUrl: null },
    listeners: 10,
    capacity: 10,
    full: true,
    starHost: false,
    cover: null,
    backdrop: null,
    createdAt: Date.now() - 600_000,
  },
];

function preview(code: string, star: boolean): RoomPreview {
  return {
    code,
    title: star ? 'Ночной эфир' : null,
    host: person(star ? 'u-kai' : 'u-lena'),
    track: null,
    listeners: star ? 18 : 10,
    capacity: star ? 25 : 10,
    starHost: star,
    cover: star ? { url: ART(11), accent: 6 } : null,
    backdrop: star ? { kind: 'preset', id: 'aurora' } : null,
    alive: true,
  };
}

function inviteEmbed(code: string) {
  return {
    kind: 'room_invite' as const,
    urn: `scd:rooms:${code}`,
    permalink: `scd://room/${code}`,
    secretToken: null,
    title: '',
    artist: null,
    artworkUrl: null,
    durationMs: null,
    access: null,
    atMs: null,
    tracks: [],
    room: { code, host: code === 'STAR25' ? 'Kai' : 'Лена', title: null },
  };
}

export const scenes: LabScene[] = [
  {
    id: 'perks-tuning-free',
    title: 'Perks: tuning, free host',
    route: '/chats/room',
    setup: (kit) => {
      hostRoom(kit, FREE, { members: crowd(4) });
      kit.click('[data-ui="room-tuning"]');
      kit.waitFor('[data-ui="room-capacity"]');
    },
  },
  {
    id: 'perks-tuning-star',
    title: 'Perks: tuning, STAR host',
    route: '/chats/room',
    setup: (kit) => {
      hostRoom(kit, STAR, { members: crowd(14), moderators: ['u-mira', 'u-sasha'] });
      kit.click('[data-ui="room-tuning"]');
      kit.waitFor('[data-ui="room-capacity"]');
    },
  },
  {
    id: 'perks-lapse',
    title: 'Perks: STAR lapsed, 13 in a room of 10',
    route: '/chats/room',
    setup: (kit) => {
      hostRoom(kit, FREE, {
        members: crowd(13),
        moderators: ['u-mira', 'u-sasha', 'u-danil', 'u-kai', 'u-lena'],
      });
      kit.click('[data-ui="room-tuning"]');
      kit.waitFor('[data-ui="room-capacity"]');
    },
  },
  {
    id: 'perks-guest',
    title: 'Perks: guest in a STAR room',
    route: '/chats/room',
    setup: (kit) => {
      kit.star(false);
      setIsPremium(false);
      kit.room({ star: true, host: false });
      patchRoom({ perks: STAR, members: crowd(9), cover: { url: ART(11), accent: 6 } });
      kit.click('[data-ui="room-tuning"]');
      kit.waitFor('[data-ui="room-capacity"]');
    },
  },
  {
    id: 'perks-cover-star',
    title: 'Perks: cover picker, STAR host',
    route: '/chats/room',
    setup: (kit) => {
      seedArtwork();
      hostRoom(kit, STAR, { cover: { url: ART(8).replace('-large', '-t500x500'), accent: 4 } });
      openCover(kit);
    },
  },
  {
    id: 'perks-cover-free',
    title: 'Perks: cover picker, free host',
    route: '/chats/room',
    setup: (kit) => {
      seedArtwork();
      hostRoom(kit, FREE);
      openCover(kit);
    },
  },
  {
    id: 'perks-cover-error',
    title: 'Perks: cover save limited',
    route: '/chats/room',
    setup: (kit) => {
      seedArtwork();
      hostRoom(kit, STAR);
      kit.handle('chat_room_settings', () => {
        throw { code: 'request_limit', retryMs: 8000 };
      });
      openCover(kit);
      kit.click('[data-ui="room-cover-picker"] [role="radio"]');
      kit.after(() => pressText(i18n.t('chat.room.perks.cover.apply')));
    },
  },
  {
    id: 'perks-policy-public',
    title: 'Perks: image policy, public room',
    route: '/chats/room',
    setup: (kit) => {
      hostRoom(kit, STAR, { public: true, roomImages: 'mods' });
      openRules(kit);
    },
  },
  {
    id: 'perks-policy-private',
    title: 'Perks: image policy, private room, free host',
    route: '/chats/room',
    setup: (kit) => {
      hostRoom(kit, FREE, { public: false, roomImages: 'members' });
      openRules(kit);
    },
  },
  {
    id: 'perks-listing',
    title: 'Perks: open rooms with STAR rooms',
    route: '/home',
    setup: (kit) => {
      useTogetherStore.setState({ phase: 'idle', room: null });
      roomsApi.open = async () => LISTING;
      kit.click(`button[aria-label="${i18n.t('together.title')}"]`);
      kit.after(() => pressText(i18n.t('together.open.title')));
      kit.waitFor('[data-ui="open-room"]');
    },
  },
  {
    id: 'perks-invite',
    title: 'Perks: room invite cards',
    route: `/chats/${CONV.dm}`,
    setup: (kit) => {
      const star = 'STAR25';
      const full = 'FULL10';
      kit.handle('chat_room_preview', (args) => preview(String(args.code), args.code === star));
      const thread = kit.world.threads[CONV.dm] ?? [];
      const last = thread[thread.length - 1];
      if (last) {
        kit.world.threads[CONV.dm] = [
          ...thread,
          {
            ...last,
            seq: last.seq + 1,
            clientId: `perks-invite-${star}`,
            sender: 'u-kai',
            mine: false,
            body: { type: 'text', text: '', spans: [] },
            embeds: [inviteEmbed(star)],
          },
          {
            ...last,
            seq: last.seq + 2,
            clientId: `perks-invite-${full}`,
            sender: 'u-lena',
            mine: false,
            body: { type: 'text', text: '', spans: [] },
            embeds: [inviteEmbed(full)],
          },
        ];
      }
    },
  },
];
