import { create } from 'zustand';
import { checkForAppUpdate, type GithubRelease } from '../lib/update-check';

export type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'error';

interface AppUpdateState {
  release: GithubRelease | null;
  status: UpdateStatus;
  checkedAt: number | null;
  modalOpen: boolean;
  dismissedTag: string | null;
  check: (manual: boolean) => Promise<void>;
  openModal: () => void;
  dismiss: () => void;
}

export const useAppUpdateStore = create<AppUpdateState>()((set, get) => ({
  release: null,
  status: 'idle',
  checkedAt: null,
  modalOpen: false,
  dismissedTag: null,

  check: async (manual) => {
    if (get().status === 'checking') return;
    set({ status: 'checking' });
    try {
      const release = await checkForAppUpdate();
      const checkedAt = Date.now();
      if (!release) {
        set({ release: null, status: 'upToDate', checkedAt, modalOpen: false });
        return;
      }
      const silenced = !manual && release.tag_name === get().dismissedTag;
      set({ release, status: 'available', checkedAt, modalOpen: get().modalOpen || !silenced });
    } catch {
      set({ status: get().release ? 'available' : 'error', checkedAt: Date.now() });
    }
  },

  openModal: () => {
    if (get().release) set({ modalOpen: true });
  },

  dismiss: () => {
    set((state) => ({ modalOpen: false, dismissedTag: state.release?.tag_name ?? null }));
  },
}));
