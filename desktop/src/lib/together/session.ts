import { toast } from 'sonner';
import i18n from '../../i18n';
import { useAuthStore } from '../../stores/auth';
import { isRoomHost, useTogetherStore } from '../../stores/together';
import { ApiError } from '../api';
import { roomsApi, type Timed } from './api';
import { attachGuest } from './guest';
import { attachHost } from './host';
import { acceptTimed, type RoomRole, resetClock, setViewListener, sleep } from './link';
import type { Profile, RoomView } from './types';

const CLOCK_WARMUP_SAMPLES = 3;
const CLOCK_REFRESH_MS = 60_000;
const MAX_BACKOFF_MS = 15_000;

let generation = 0;
let role: RoomRole | null = null;

function profile(): Profile {
  const user = useAuthStore.getState().user;
  return { name: user?.username ?? '', avatarUrl: user?.avatar_url ?? null };
}

function selfId(): string | null {
  const user = useAuthStore.getState().user;
  if (!user) return null;
  return user.id ? String(user.id) : (user.urn.split(':').pop() ?? null);
}

function announceMembers(view: RoomView, previous: RoomView | null): void {
  if (!previous) return;
  const self = useTogetherStore.getState().selfId;
  const before = new Set(previous.members.map((m) => m.userId));
  const after = new Set(view.members.map((m) => m.userId));
  for (const member of view.members) {
    if (member.userId !== self && !before.has(member.userId)) {
      toast(i18n.t('together.toast.joined', { name: member.name }));
    }
  }
  for (const member of previous.members) {
    if (member.userId !== self && !after.has(member.userId)) {
      toast(i18n.t('together.toast.left', { name: member.name }));
    }
  }
}

function endSession(reason: 'left' | 'ended'): void {
  generation++;
  role?.detach();
  role = null;
  setViewListener(null);
  const wasGuest = !isRoomHost(useTogetherStore.getState());
  useTogetherStore.setState({
    phase: 'idle',
    room: null,
    selfId: null,
    sync: 'synced',
    waitingFor: 0,
  });
  if (reason === 'ended' && wasGuest) toast(i18n.t('together.toast.ended'));
}

async function warmClock(gen: number, code: string): Promise<void> {
  for (let i = 0; i < CLOCK_WARMUP_SAMPLES; i++) {
    try {
      const timed = await roomsApi.peek(code);
      if (gen !== generation) return;
      acceptTimed(timed);
    } catch {
      return;
    }
  }
}

async function pollLoop(gen: number): Promise<void> {
  let failures = 0;
  let lastPeek = Date.now();
  while (gen === generation) {
    const room = useTogetherStore.getState().room;
    if (!room) return;
    try {
      const refreshClock = Date.now() - lastPeek > CLOCK_REFRESH_MS;
      const timed = refreshClock
        ? await roomsApi.peek(room.code)
        : await roomsApi.poll(room.code, room.version);
      if (gen !== generation) return;
      if (refreshClock) lastPeek = Date.now();
      acceptTimed(timed, refreshClock);
      failures = 0;
      if (useTogetherStore.getState().phase === 'reconnecting') {
        useTogetherStore.setState({ phase: 'live' });
      }
    } catch (error) {
      if (gen !== generation) return;
      if (error instanceof ApiError && error.status === 404) {
        endSession('ended');
        return;
      }
      failures++;
      useTogetherStore.setState({ phase: 'reconnecting' });
      await sleep(Math.min(1000 * 2 ** failures, MAX_BACKOFF_MS));
    }
  }
}

async function enter(open: () => Promise<Timed>): Promise<void> {
  await leaveSession();
  const gen = ++generation;
  useTogetherStore.setState({ phase: 'connecting' });
  let timed: Timed;
  try {
    timed = await open();
  } catch (error) {
    if (gen === generation) useTogetherStore.setState({ phase: 'idle' });
    throw error;
  }
  if (gen !== generation) return;
  resetClock();
  useTogetherStore.setState({ phase: 'live', room: timed.view, selfId: selfId() });
  role = isRoomHost(useTogetherStore.getState()) ? attachHost() : attachGuest();
  setViewListener((view, previous) => {
    announceMembers(view, previous);
    role?.onView(view);
  });
  acceptTimed(timed);
  void warmClock(gen, timed.view.code);
  void pollLoop(gen);
}

export function hostSession(): Promise<void> {
  return enter(() => roomsApi.create(profile()));
}

export function joinSession(code: string): Promise<void> {
  return enter(() => roomsApi.join(code, profile()));
}

export async function leaveSession(): Promise<void> {
  const room = useTogetherStore.getState().room;
  if (!room) return;
  endSession('left');
  await roomsApi.leave(room.code).catch(() => {});
}

export function shareText(code: string): string {
  return i18n.t('together.shareText', { code });
}

useAuthStore.subscribe((state, prev) => {
  if (prev.user && !state.user) void leaveSession();
});
