import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { track } from '@/analytics';
import { ApiError } from '@/api/client';
import { updateProfile } from '@/api/endpoints/profile';
import { answerSizePrompt, listSizePrompts } from '@/api/endpoints/sizePrompts';
import type { Profile, SizePrompt, SizePromptAnswer, SizePromptList } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { showToast } from '@/components/toastStore';
import { toUpdateRequest, useProfile } from '@/features/profile/hooks';
import { tr } from '@/i18n/tr';
import { useSession } from '@/session/useSession';

import { confirmationLine } from './labels';

/**
 * Questions are for a signed-in user whose profile says they are on (the default). The profile is waited for, so a
 * user who turned them off never sees one flash by.
 */
export function useSizePromptsEnabled(): boolean {
  const { isSignedIn } = useSession();
  const profile = useProfile();
  return isSignedIn && profile.data?.sizePromptsEnabled === true;
}

/** The first open question, or `null`: the card shows one at a time and reserves no room when there is none. */
export function useFirstSizePrompt(): SizePrompt | null {
  const enabled = useSizePromptsEnabled();
  const prompts = useQuery({
    queryKey: queryKeys.sizePrompts,
    queryFn: ({ signal }) => listSizePrompts(signal),
    enabled,
    staleTime: 5 * 60_000,
    select: (data) => data.prompts,
  });
  // A cached list must not outlive the switch: turning questions off hides the card at once.
  return enabled ? (prompts.data?.[0] ?? null) : null;
}

function dropPrompt(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<SizePromptList>(queryKeys.sizePrompts, (current) =>
    current
      ? { ...current, prompts: current.prompts.filter((prompt) => prompt.id !== id) }
      : current,
  );
}

/** An answered or expired question (or one that is not the user's): nothing to retry, the card just goes. */
export function isGone(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 409 || error.status === 404);
}

interface AnswerInput {
  prompt: SizePrompt;
  answer: SizePromptAnswer;
  size: string | null;
}

/**
 * Sends one answer. On success the question leaves the list (the next one, if any, takes its place), the size map and
 * the size hints are refreshed, and `onAnswered` gets the one confirming line. The mutation is owned by the card's
 * parent, which outlives the question, so the line can replace the row for a moment after the answered question has
 * left the list. A 409 drops the card silently and refetches; any
 * other error leaves the card where it is for the caller to show.
 */
export function useAnswerSizePrompt(onAnswered: (line: string) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ prompt, answer, size }: AnswerInput) =>
      answerSizePrompt(prompt.id, { answer, size }),
    onSuccess: (_result, { prompt, answer, size }) => {
      dropPrompt(queryClient, prompt.id);
      track('size_prompt_answer', { promptId: prompt.id, answer });
      onAnswered(confirmationLine(prompt, answer, size));
      void queryClient.invalidateQueries({ queryKey: queryKeys.sizePrompts, refetchType: 'none' });
      // A confirmed fit changes the size map and the hint on every product.
      void queryClient.invalidateQueries({ queryKey: queryKeys.sizes });
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'product'] });
    },
    onError: (error, { prompt }) => {
      if (isGone(error)) {
        dropPrompt(queryClient, prompt.id);
        void queryClient.invalidateQueries({ queryKey: queryKeys.sizePrompts });
      }
    },
  });
}

/** "Beden sorularını göster" in Profil: flips at once, and goes back with a toast when the server says no. */
export function useSetSizePrompts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ profile, enabled }: { profile: Profile; enabled: boolean }) =>
      updateProfile(toUpdateRequest(profile, { sizePromptsEnabled: enabled })),
    onMutate: async ({ profile, enabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.profile });
      queryClient.setQueryData<Profile>(queryKeys.profile, {
        ...profile,
        sizePromptsEnabled: enabled,
      });
      return { previous: profile };
    },
    onError: (_error, _input, context) => {
      if (context) {
        queryClient.setQueryData<Profile>(queryKeys.profile, context.previous);
      }
      showToast(tr.sizePromptsToggleFailed);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData<Profile>(queryKeys.profile, profile);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sizePrompts });
    },
  });
}
