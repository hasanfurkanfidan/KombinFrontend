import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteTrip,
  getTrip,
  listTrips,
  planTrip,
  replanTrip,
  saveTrip,
} from '@/api/endpoints/trips';
import type { SaveTripRequest, TripPlanRequest } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

/** Planning is a mutation: a plan is for the request just made and is not cached. */
export function usePlanTrip() {
  return useMutation({ mutationFn: (body: TripPlanRequest) => planTrip(body) });
}

export function useSavedTrips() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.trips,
    queryFn: ({ signal }) => listTrips(signal),
    enabled: isSignedIn,
  });
}

export function useTrip(id: string) {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.trip(id),
    queryFn: ({ signal }) => getTrip(id, signal),
    enabled: isSignedIn,
  });
}

export function useSaveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveTripRequest) => saveTrip(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.trips }),
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.trip(id) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.trips });
    },
  });
}

/** Plans a saved trip again; the answer replaces the trip in the cache. */
export function useReplanTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => replanTrip(id),
    onSuccess: (trip) => {
      queryClient.setQueryData(queryKeys.trip(trip.id), trip);
      void queryClient.invalidateQueries({ queryKey: queryKeys.trips });
    },
  });
}
