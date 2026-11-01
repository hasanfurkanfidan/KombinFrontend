import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  activatePersona,
  archivePersona,
  createPersona,
  listPersonas,
  updatePersona,
} from '@/api/endpoints/profile';
import type { Persona, PersonaList } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

/** The backend allows at most this many active personas per user. */
export const MAX_PERSONAS = 6;

/** The signed-in user's personas (active one included); disabled while logged out. */
export function usePersonas() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.personas,
    queryFn: ({ signal }) => listPersonas(signal),
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
    select: (data) => data.items,
  });
}

/** The persona whose match scores and `personaId` the product screens use; undefined when there is none. */
export function useActivePersona(): Persona | undefined {
  return usePersonas().data?.find((persona) => persona.isActive);
}

/** Personas change which products match and how well, so everything derived from them is refetched. */
async function refreshPersonaDependents(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.personas }),
    queryClient.invalidateQueries({ queryKey: queryKeys.profile }),
    queryClient.invalidateQueries({ queryKey: queryKeys.productsAll }),
    queryClient.invalidateQueries({ queryKey: ['catalog', 'product'] }),
  ]);
}

export function useCreatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; icon: string }) => createPersona(input),
    onSuccess: () => refreshPersonaDependents(queryClient),
  });
}

/** Switches the active persona; the chip row updates immediately and rolls back if the call fails. */
export function useActivatePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activatePersona(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.personas });
      const previous = queryClient.getQueryData<PersonaList>(queryKeys.personas);
      if (previous) {
        queryClient.setQueryData<PersonaList>(queryKeys.personas, {
          items: previous.items.map((persona) => ({ ...persona, isActive: persona.id === id })),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.personas, context.previous);
      }
    },
    onSettled: () => refreshPersonaDependents(queryClient),
  });
}

export function useRenamePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updatePersona(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.personas }),
  });
}

export function useArchivePersona() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => archivePersona(id),
    onSuccess: () => refreshPersonaDependents(queryClient),
  });
}
