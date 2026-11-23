import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/api/client';
import { createAsk, getAskConsent } from '@/api/endpoints/askFriend';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

import { AskFriendError, type AskResponse, type CreateAskRequest } from './types';

/**
 * The consent query, asked once per session (a sign-out clears the cache). A 404 `AskFriend.Disabled` is stored as
 * an error and never retried; the button stays hidden.
 */
export function useAskConsent() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.askConsent,
    queryFn: ({ signal }) => getAskConsent(signal),
    enabled: isSignedIn,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (failureCount, error) => {
      const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
      return !clientError && failureCount < 2;
    },
  });
}

/**
 * Whether to show "Arkadaşına sor": only once the consent answer is in. False while loading, on 404
 * `AskFriend.Disabled`, and on any other failure (the button is better hidden than broken).
 */
export function useAskFriendEnabled(): boolean {
  const { data } = useAskConsent();
  return data !== undefined;
}

/**
 * Creates an ask. On 409 `ConsentRequired` the consent is fetched again so the sheet can show the new text.
 */
export function useCreateAsk() {
  const queryClient = useQueryClient();
  return useMutation<AskResponse, Error, CreateAskRequest>({
    mutationFn: (body) => createAsk(body),
    onSuccess: () => {
      // The first ask accepts the consent: the next one skips the sheet.
      void queryClient.invalidateQueries({ queryKey: queryKeys.askConsent });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.errorCode === AskFriendError.ConsentRequired) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.askConsent });
      }
    },
  });
}
