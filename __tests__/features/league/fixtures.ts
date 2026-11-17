import type {
  LeagueMe,
  LeagueNextPair,
  LeaguePiece,
  LeagueResults,
  LeagueTable,
  LeagueVoteResult,
} from '@/api/models';

export const CONSENT_TEXT =
  'Katılırsan dolabındaki parçaların fotoğrafları diğer oyunculara gösterilir. Bu metin sunucudan gelir.';
export const CONSENT_VERSION = '2026-11-v2';

export const PAIR_ID = '00000000-0000-4000-8000-0000000000a1';
export const NEXT_PAIR_ID = '00000000-0000-4000-8000-0000000000a2';

/** Far in the future: a test that is not about the closing time must never find the day closed. */
export const OPEN_UNTIL = '2099-01-01T18:00:00Z';
/** 21:00 in Istanbul on Monday 2 November 2026, and Sunday 8 November: the day's and the week's close. */
export const DAY_CLOSE = '2026-11-02T18:00:00Z';
export const WEEK_END = '2026-11-08T18:00:00Z';

export function piece(
  slot: LeaguePiece['slot'],
  imageUrl: string | null = `https://img.test/${slot}.jpg`,
): LeaguePiece {
  return { slot, imageUrl };
}

export const OUTFIT: LeaguePiece[] = [piece('Top'), piece('Bottom'), piece('Shoes')];

export function leagueMe(overrides: Partial<LeagueMe> = {}): LeagueMe {
  return {
    joined: true,
    consentRequired: false,
    consent: { version: CONSENT_VERSION, text: CONSENT_TEXT },
    tier: 'Gold',
    joinedAt: '2026-10-20T10:00:00Z',
    today: {
      day: '2026-11-02',
      closesAt: OPEN_UNTIL,
      entry: null,
      servedPairs: 3,
      countedVotes: 3,
      target: 10,
      limit: 30,
    },
    week: { groupRank: 7, groupSize: 30, points: 414, pointsToPromotion: 17, endsAt: WEEK_END },
    ...overrides,
  };
}

export function notJoined(overrides: Partial<LeagueMe> = {}): LeagueMe {
  return leagueMe({
    joined: false,
    consentRequired: true,
    tier: null,
    joinedAt: null,
    week: null,
    ...overrides,
  });
}

export function todayWith(patch: Partial<LeagueMe['today']>): LeagueMe['today'] {
  return { ...leagueMe().today, ...patch };
}

export function nextPair(overrides: Partial<LeagueNextPair> = {}): LeagueNextPair {
  return {
    pair: {
      id: PAIR_ID,
      left: {
        pieces: [
          piece('Top', 'https://img.test/left-top.jpg'),
          piece('Bottom', 'https://img.test/left-bottom.jpg'),
          piece('Shoes', 'https://img.test/left-shoes.jpg'),
        ],
      },
      right: {
        pieces: [
          piece('Top', 'https://img.test/right-top.jpg'),
          piece('Bottom', 'https://img.test/right-bottom.jpg'),
          piece('Shoes', 'https://img.test/right-shoes.jpg'),
        ],
      },
      sequence: 4,
    },
    reason: null,
    countedToday: 3,
    servedToday: 3,
    target: 10,
    limit: 30,
    closesAt: OPEN_UNTIL,
    ...overrides,
  };
}

export function voteResult(overrides: Partial<LeagueVoteResult> = {}): LeagueVoteResult {
  return {
    counted: true,
    chosenWinRate: 72,
    chosenGames: 18,
    countedToday: 4,
    servedToday: 4,
    target: 10,
    limit: 30,
    ...overrides,
  };
}

export function results(overrides: Partial<LeagueResults> = {}): LeagueResults {
  return {
    day: '2026-11-02',
    status: 'Final',
    message: null,
    entry: { pieces: OUTFIT },
    competed: true,
    ranked: true,
    rank: 12,
    rankedCount: 86,
    comparisons: 22,
    points: { votes: 61, voting: 15, worn: 10, pieces: 0, total: 86 },
    piecePointsAvailable: true,
    week: { tier: 'Gold', groupRank: 7, pointsToPromotion: 17, endsAt: WEEK_END },
    ...overrides,
  };
}

const ALIASES = [
  'Yeşil Trençkot',
  'Lacivert Blazer',
  'Bordo Kazak',
  'Bej Gömlek',
  'Siyah Ceket',
  'Gri Hırka',
  'Sen',
  'Krem Triko',
  'Haki Parka',
];
const POINTS = [486, 471, 455, 442, 431, 420, 414, 402, 388];

/** The design's table: nine rows, the player 7th, five to go up, none to go down yet. */
export function table(overrides: Partial<LeagueTable> = {}): LeagueTable {
  return {
    weekStart: '2026-11-02',
    endsAt: WEEK_END,
    tier: 'Gold',
    todayPoints: 74,
    todayIsFinal: true,
    promoteCount: 5,
    relegateCount: 2,
    tierUp: 'Platinum',
    tierDown: 'Silver',
    size: 30,
    rows: ALIASES.map((alias, index) => ({
      rank: index + 1,
      points: POINTS[index] ?? 0,
      isMe: index === 6,
      alias,
    })),
    ...overrides,
  };
}
