import { create } from 'zustand';
import type { NameOf } from '../../../../lib/chat/render';
import type { ConvId, Seq } from '../../../../lib/chat/types';
import { useChatThreadStore } from '../../../../stores/chat/thread';
import { imagesBefore, sameImage, type ViewImage } from './images';

export interface LightboxSession {
  token: number;
  thread: ConvId | null;
  items: ViewImage[];
  index: number;
  oldest: Seq | null;
  more: boolean;
  loadingOlder: boolean;
  nameOf: NameOf;
  onJump: ((seq: Seq) => void) | null;
  opener: HTMLElement | null;
}

export interface OpenInput {
  items: ViewImage[];
  start: ViewImage;
  more: boolean;
  nameOf: NameOf;
  onJump: ((seq: Seq) => void) | null;
  opener: HTMLElement | null;
}

interface LightboxState {
  session: LightboxSession | null;
}

const OLDER_ROUNDS = 3;

export const useLightboxStore = create<LightboxState>()(() => ({ session: null }));

let tokens = 0;

function oldestSeq(items: ViewImage[]): Seq | null {
  for (const item of items) if (item.seq !== null) return item.seq;
  return null;
}

export function openLightbox({ items, start, more, nameOf, onJump, opener }: OpenInput) {
  const list = items.length > 0 ? items : [start];
  const index = Math.max(
    0,
    list.findIndex((item) => sameImage(item, start)),
  );
  useLightboxStore.setState({
    session: {
      token: ++tokens,
      thread: useChatThreadStore.getState().openId,
      items: list,
      index,
      oldest: oldestSeq(list),
      more,
      loadingOlder: false,
      nameOf,
      onJump,
      opener,
    },
  });
}

export function closeLightbox() {
  useLightboxStore.setState({ session: null });
}

function patch(token: number, next: Partial<LightboxSession>) {
  useLightboxStore.setState((state) =>
    state.session?.token === token ? { session: { ...state.session, ...next } } : state,
  );
}

function live(token: number): LightboxSession | null {
  const session = useLightboxStore.getState().session;
  return session?.token === token ? session : null;
}

async function loadOlder(session: LightboxSession) {
  const { token } = session;
  const conversationId = session.items[0]?.conversationId;
  if (!conversationId || !session.more || session.loadingOlder) return;
  patch(token, { loadingOlder: true });
  let oldest = session.oldest;
  let more: boolean = session.more;
  try {
    for (let round = 0; round < OLDER_ROUNDS && more; round++) {
      const page = await imagesBefore(conversationId, oldest);
      const current = live(token);
      if (!current) return;
      oldest = page.oldest ?? oldest;
      more = page.more;
      const fresh = page.images.filter(
        (image) => !current.items.some((item) => sameImage(item, image)),
      );
      if (fresh.length === 0) {
        patch(token, { oldest, more });
        continue;
      }
      patch(token, {
        items: [...fresh, ...current.items],
        index: current.index === 0 ? fresh.length - 1 : current.index + fresh.length,
        oldest,
        more,
      });
      return;
    }
  } catch {
    return;
  } finally {
    patch(token, { loadingOlder: false });
  }
}

export function stepLightbox(delta: number) {
  const session = useLightboxStore.getState().session;
  if (!session) return;
  const target = session.index + delta;
  if (target >= 0 && target < session.items.length) {
    patch(session.token, { index: target });
    return;
  }
  if (target < 0) void loadOlder(session);
}

export function pickLightbox(index: number) {
  const session = useLightboxStore.getState().session;
  if (session && index >= 0 && index < session.items.length) patch(session.token, { index });
}

export function jumpFromLightbox() {
  const session = useLightboxStore.getState().session;
  const item = session?.items[session.index];
  if (!session || !item || item.seq === null || !session.onJump) return;
  const { onJump } = session;
  const seq = item.seq;
  closeLightbox();
  onJump(seq);
}
