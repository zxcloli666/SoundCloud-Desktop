import { create } from 'zustand';

export type DiscordStatus = 'idle' | 'connected' | 'unavailable';

export const useDiscordStatusStore = create<{ status: DiscordStatus }>(() => ({ status: 'idle' }));
