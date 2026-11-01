import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getMe } from '@/api/endpoints/auth';
import { getProfile, updateProfile } from '@/api/endpoints/profile';
import type { Profile, UpdateProfileRequest } from '@/api/models';
import { queryKeys } from '@/api/queryKeys';
import { useSession } from '@/session/useSession';

/** The signed-in user's profile; disabled (and empty) while logged out. */
export function useMe() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: ({ signal }) => getMe(signal),
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
  });
}

/** `GET /me/profile`: audience, measurements, persona count. Disabled while logged out. */
export function useProfile() {
  const { isSignedIn } = useSession();
  return useQuery({
    queryKey: queryKeys.profile,
    queryFn: ({ signal }) => getProfile(signal),
    enabled: isSignedIn,
    staleTime: 5 * 60_000,
  });
}

/**
 * `PUT /me/profile` replaces the measurements (a field left out is cleared) and keeps the audience when it is null,
 * so an update always carries the current measurements and only overrides what changed.
 */
export function toUpdateRequest(
  profile: Profile,
  patch: Partial<UpdateProfileRequest> = {},
): UpdateProfileRequest {
  return {
    audience: null,
    birthYear: profile.birthYear,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    chestCm: profile.chestCm,
    waistCm: profile.waistCm,
    hipCm: profile.hipCm,
    shoeSizeEu: profile.shoeSizeEu,
    ...patch,
  };
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => updateProfile(body),
    onSuccess: async (profile) => {
      queryClient.setQueryData(queryKeys.profile, profile);
      // Measurements feed the size hint on product detail.
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'product'] });
    },
  });
}
