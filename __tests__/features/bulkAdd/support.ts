import type { BulkBatch, BulkPiece } from '@/api/models';

export function piece(overrides: Partial<BulkPiece> = {}): BulkPiece {
  return {
    id: 'pc1',
    thumbUrl: 'http://img.test/pc1-thumb.webp?sig=1',
    imageUrl: 'http://img.test/pc1.webp?sig=1',
    urlsExpireAt: new Date(Date.now() + 3_600_000).toISOString(),
    box: { x: 0, y: 0, w: 0.3, h: 0.3 },
    preTicked: true,
    reasons: [],
    category: { slug: 'ust-giyim/tisort', name: 'Tişört' },
    needsCategory: false,
    categoryCandidates: [
      { slug: 'ust-giyim/tisort', name: 'Tişört' },
      { slug: 'ust-giyim/gomlek', name: 'Gömlek' },
    ],
    primaryColor: 'Blue',
    secondaryColor: null,
    pattern: 'Solid',
    warnings: [],
    likelyDuplicate: null,
    ...overrides,
  };
}

export function batch(overrides: Partial<BulkBatch> = {}): BulkBatch {
  return {
    id: 'batch-1',
    status: 'Ready',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    refusal: null,
    failure: null,
    pieces: [],
    unseparated: null,
    cutOff: null,
    items: null,
    ...overrides,
  };
}
