// TODO: replace with generated types after AF2 contract (the swap is a one-file change: everything else in the app
// imports the ask types and error codes from this file only). Shapes follow docs/design/ask-a-friend.md section 5.

export type AskKind = 'Single' | 'Pair';
export type AskStatus = 'Open' | 'Expired' | 'Closed' | 'Hidden';
export type AskOptionLabel = 'A' | 'B';
export type AskChoice = 'Yes' | 'No' | 'A' | 'B';

/** `GET /api/v1/me/asks/consent`. The sheet is shown only while `accepted` is false. */
export interface AskConsent {
  version: string;
  text: string;
  accepted: boolean;
}

/** `POST /api/v1/me/asks`: one or two distinct outfit ids, and the consent version the user was shown. */
export interface CreateAskRequest {
  outfitIds: string[];
  consentVersion: string;
}

export interface AskPiece {
  slot: string;
  imageUrl: string | null;
}

export interface AskOption {
  option: AskOptionLabel;
  outfitId: string | null;
  pieces: AskPiece[];
}

export interface AskTally {
  yes: number;
  no: number;
  a: number;
  b: number;
  total: number;
}

export interface AskAnswer {
  id: string;
  choice: AskChoice;
  name: string | null;
  note: string | null;
  answeredAt: string;
}

export interface AskResponse {
  id: string;
  kind: AskKind;
  status: AskStatus;
  statusMessage: string | null;
  /** Only while `Open`. */
  url: string | null;
  shareText: string;
  createdAt: string;
  expiresAt: string;
  options: AskOption[];
  tally: AskTally;
  answers: AskAnswer[];
}

export interface AskSummary {
  id: string;
  kind: AskKind;
  status: AskStatus;
  createdAt: string;
  expiresAt: string;
  total: number;
  /** `null` on a tie or no answer. */
  leading: AskChoice | null;
}

/** The `errorCode` values of the ask routes. */
export const AskFriendError = {
  Disabled: 'AskFriend.Disabled',
  AgeRestricted: 'AskFriend.AgeRestricted',
  ConsentRequired: 'AskFriend.ConsentRequired',
  NothingToShow: 'AskFriend.NothingToShow',
  DailyLimit: 'AskFriend.DailyLimit',
  StorageUnavailable: 'AskFriend.StorageUnavailable',
  OutfitNotFound: 'AskFriend.OutfitNotFound',
} as const;
export type AskFriendErrorCode = (typeof AskFriendError)[keyof typeof AskFriendError];
