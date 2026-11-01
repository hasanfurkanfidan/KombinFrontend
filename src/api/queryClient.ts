import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './client';

const MAX_RETRIES = 2;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) => {
        // A 4xx answer is final; only connection problems and 5xx are worth another attempt.
        const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
        return !clientError && failureCount < MAX_RETRIES;
      },
    },
  },
});
