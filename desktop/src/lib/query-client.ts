import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      // Keep recently visited screens warm long enough for normal navigation.
      // The old 3-minute GC was shorter than staleTime, so a still-fresh query
      // was deleted and downloaded again after a brief detour to another page.
      gcTime: 1000 * 60 * 15,
      // Transport and playback layers already own bounded fallbacks. A second
      // invisible query attempt used to turn a 20s failure into a 40s spinner.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
