import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAlert,
  deleteAlert,
  listAlerts,
  listTriggers,
  updateAlert,
} from '@/api/endpoints/engagement';
import type { Alert, AlertList, CreateAlertRequest } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

export const TRIGGERS_PAGE_SIZE = 50;

export function useAlerts() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: ({ signal }) => listAlerts(signal),
    enabled: isSignedIn,
    select: (data) => data.items,
  });
}

export function useTriggers() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.triggers,
    queryFn: ({ signal }) => listTriggers(TRIGGERS_PAGE_SIZE, signal),
    enabled: isSignedIn,
    select: (data) => data.items,
  });
}

/** The product's active alert, if any: the bell on the detail screen is filled when there is one. */
export function useHasAlert(productId: string): boolean {
  const alerts = useAlerts().data;
  return alerts?.some((alert) => alert.product.id === productId && alert.isActive) ?? false;
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAlertRequest) => createAlert(body),
    onSuccess: (alert) => {
      queryClient.setQueryData<AlertList>(queryKeys.alerts, (current) => ({
        items: [alert, ...(current?.items ?? [])],
      }));
      void queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateAlert(id, { isActive }),
    onSuccess: (updated: Alert) => {
      queryClient.setQueryData<AlertList>(queryKeys.alerts, (current) =>
        current
          ? { items: current.items.map((alert) => (alert.id === updated.id ? updated : alert)) }
          : current,
      );
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAlert(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.alerts });
      const previous = queryClient.getQueryData<AlertList>(queryKeys.alerts);
      if (previous) {
        queryClient.setQueryData<AlertList>(queryKeys.alerts, {
          items: previous.items.filter((alert) => alert.id !== id),
        });
      }
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.alerts, context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.alerts }),
  });
}
