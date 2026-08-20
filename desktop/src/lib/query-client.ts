import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 3,
      // Transport and playback layers already own bounded fallbacks. A second
      // invisible query attempt used to turn a 20s failure into a 40s spinner.
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});
