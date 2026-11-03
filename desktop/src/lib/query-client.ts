import { QueryClient } from '@tanstack/react-query';
import { queryRetryDelay } from './pacing';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 3,
      retry: 1,
      retryDelay: queryRetryDelay,
      refetchOnWindowFocus: false,
    },
  },
});
