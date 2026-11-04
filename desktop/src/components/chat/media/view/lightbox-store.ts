import { create } from 'zustand';
import type { NameOf } from '../../../../lib/chat/render';
import type { Seq } from '../../../../lib/chat/types';
import { imagesBefore, sameImage, type ViewImage } from './images';

export interface LightboxSession {
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
}

interface LightboxState {
  session: LightboxSession | null;
}

export const useLightboxStore = create<LightboxState>()(() => ({ session: null }));

function oldestSeq(items: ViewImage[]): Seq | null {
  for (const item of items) if (item.seq !== null) return item.seq;
  return null;
}

export function openLightbox({ items, start, more, nameOf, onJump }: OpenInput) {
  const index = Math.max(
    0,
    items.findIndex((item) => sameImage(item, start)),
  );
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  useLightboxStore.setState({
    session: {
      items: items.length > 0 ? items : [start],
      index,
      oldest: oldestSeq(items),
      more,
      loadingOlder: false,
      nameOf,
      onJump,
      opener,
    },
  });
}

export function closeLightbox() {
  const opener = useLightboxStore.getState().session?.opener ?? null;
  useLightboxStore.setState({ session: null });
  if (opener?.isConnected) opener.focus({ preventScroll: true });
}

function patch(next: Partial<LightboxSession>) {
  useLightboxStore.setState((state) =>
    state.session ? { session: { ...state.session, ...next } } : state,
  );
}

async function loadOlder(): Promise<boolean> {
  const session = useLightboxStore.getState().session;
  if (!session?.more || session.loadingOlder) return false;
  const conversationId = session.items[0]?.conversationId;
  if (!conversationId) return false;
  patch({ loadingOlder: true });
  try {
    const page = await imagesBefore(conversationId, session.oldest);
    const current = useLightboxStore.getState().session;
    if (!current || current.items[0]?.conversationId !== conversationId) return false;
    const fresh = page.images.filter(
      (image) => !current.items.some((item) => sameImage(item, image)),
    );
    patch({
      items: [...fresh, ...current.items],
      index: current.index + fresh.length,
      oldest: page.oldest ?? current.oldest,
      more: page.more,
      loadingOlder: false,
    });
    return fresh.length > 0;
  } catch {
    patch({ loadingOlder: false });
    return false;
  }
}

export async function stepLightbox(delta: number) {
  const session = useLightboxStore.getState().session;
  if (!session) return;
  const target = session.index + delta;
  if (target >= 0 && target < session.items.length) {
    patch({ index: target });
    return;
  }
  if (target < 0 && (await loadOlder())) {
    const next = useLightboxStore.getState().session;
    if (next) patch({ index: Math.max(0, next.index - 1) });
  }
}

export function jumpFromLightbox() {
  const session = useLightboxStore.getState().session;
  const item = session?.items[session.index];
  if (!session || !item || item.seq === null || !session.onJump) return;
  const { onJump } = session;
  const seq = item.seq;
  useLightboxStore.setState({ session: null });
  onJump(seq);
}

export function pickLightbox(index: number) {
  const session = useLightboxStore.getState().session;
  if (session && index >= 0 && index < session.items.length) patch({ index });
}
