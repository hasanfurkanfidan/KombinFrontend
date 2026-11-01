import { useQuery } from '@tanstack/react-query';

import { getMe } from '@/api/endpoints/auth';
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
