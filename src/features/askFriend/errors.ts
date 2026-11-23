import { ApiError } from '@/api/client';
import { tr } from '@/i18n/tr';

import { AskFriendError } from './types';

/** The Turkish line for a failed create. Falls back to the generic line for anything unknown. */
export function askErrorMessage(error: unknown): string {
  return tr[askErrorKey(error)];
}

export type AskErrorKey =
  | 'askErrorAge'
  | 'askErrorConsent'
  | 'askErrorNothingToShow'
  | 'askErrorDailyLimit'
  | 'askErrorStorage'
  | 'askErrorNetwork'
  | 'askErrorGeneric';

/** The `tr` key for a failed create (pure, so a screen and a test can both use it). */
export function askErrorKey(error: unknown): AskErrorKey {
  if (!(error instanceof ApiError)) {
    return 'askErrorGeneric';
  }
  if (error.isNetworkError) {
    return 'askErrorNetwork';
  }
  switch (error.errorCode) {
    case AskFriendError.AgeRestricted:
      return 'askErrorAge';
    case AskFriendError.ConsentRequired:
      return 'askErrorConsent';
    case AskFriendError.NothingToShow:
      return 'askErrorNothingToShow';
    case AskFriendError.DailyLimit:
      return 'askErrorDailyLimit';
    case AskFriendError.StorageUnavailable:
      return 'askErrorStorage';
  }
  return error.status === 503 ? 'askErrorStorage' : 'askErrorGeneric';
}
