import { create } from 'zustand';

interface OfferPeakState {
  raised: boolean;
  raise: () => void;
  clear: () => void;
}

export const useOfferPeak = create<OfferPeakState>()((set) => ({
  raised: false,
  raise: () => set({ raised: true }),
  clear: () => set({ raised: false }),
}));
