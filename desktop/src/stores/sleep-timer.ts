import { create } from 'zustand';

export type SleepTimer = { kind: 'time'; endsAt: number } | { kind: 'track' };

export const useSleepTimerStore = create<{ timer: SleepTimer | null }>(() => ({ timer: null }));
