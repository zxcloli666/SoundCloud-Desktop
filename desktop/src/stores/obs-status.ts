import { create } from 'zustand';

export type ObsServerStatus = 'off' | 'running' | 'busy' | 'failed';

export interface ObsStatus {
  server: ObsServerStatus;
  port: number;
  txtError: string | null;
}

export const useObsStatusStore = create<{ status: ObsStatus | null }>(() => ({ status: null }));
