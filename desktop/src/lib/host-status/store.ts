import { create } from 'zustand';
import { API_BASE } from '../constants';

export type HostVerdict = 'up' | 'down' | 'unknown';
export type NetVerdict = 'unknown' | 'online' | 'no-internet';

export interface HostStatusState {
  main: HostVerdict;
  net: NetVerdict;
  probing: boolean;
  incidentId: number;
  modalDismissedIncidentId: number;
  lastModalDismissAt: number;
  dismissModal: () => void;
  reopenModal: () => void;
}

export const useHostStatusStore = create<HostStatusState>()((set, get) => ({
  main: 'unknown',
  net: 'unknown',
  probing: false,
  incidentId: 0,
  modalDismissedIncidentId: -1,
  lastModalDismissAt: 0,
  dismissModal: () =>
    set({ modalDismissedIncidentId: get().incidentId, lastModalDismissAt: Date.now() }),
  reopenModal: () => set({ modalDismissedIncidentId: -1 }),
}));

export type FailoverUi = 'none' | 'all-down';

export function selectFailoverUi(
  state: Pick<HostStatusState, 'main' | 'net'>,
  navigatorOnline: boolean,
  offlineBypass: boolean,
): FailoverUi {
  if (!navigatorOnline || offlineBypass || state.net === 'no-internet') return 'none';
  return state.main === 'down' ? 'all-down' : 'none';
}

export function getHostVerdict(base: string): HostVerdict {
  return base === API_BASE ? useHostStatusStore.getState().main : 'unknown';
}

export function isIncidentActive(): boolean {
  return useHostStatusStore.getState().main === 'down';
}
