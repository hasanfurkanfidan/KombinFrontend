import type { OfferSeries, StockStatus } from '@/api/models';
import { buildChartGeometry, buildPricePoints } from '@/features/catalog/priceHistory';

const seller = { id: 's', name: 'Seller', slug: 'seller', kind: 'Marketplace' } as const;

function series(offerId: string, points: [string, number | string, StockStatus?][]): OfferSeries {
  return {
    offerId,
    seller,
    points: points.map(([date, minPrice, stockStatus]) => ({
      date,
      minPrice,
      stockStatus: stockStatus ?? 'InStock',
    })),
  };
}

describe('buildPricePoints', () => {
  it('returns nothing for no history', () => {
    expect(buildPricePoints([])).toEqual([]);
    expect(buildPricePoints([series('a', [])])).toEqual([]);
  });

  it('keeps a single seller as is, sorted by date, normalizing string prices', () => {
    const points = buildPricePoints([
      series('a', [
        ['2026-10-03', 90],
        ['2026-10-01', '100'],
      ]),
    ]);

    expect(points).toEqual([
      { date: '2026-10-01', minPrice: 100 },
      { date: '2026-10-03', minPrice: 90 },
    ]);
  });

  it('takes the cheapest seller per day and carries each seller price forward', () => {
    const points = buildPricePoints([
      series('a', [
        ['2026-10-01', 100],
        ['2026-10-04', 130],
      ]),
      series('b', [
        ['2026-10-02', 80],
        ['2026-10-06', 120],
      ]),
    ]);

    expect(points).toEqual([
      { date: '2026-10-01', minPrice: 100 },
      { date: '2026-10-02', minPrice: 80 },
      // Seller b still charges 80 on the 4th even though it has no snapshot that day.
      { date: '2026-10-04', minPrice: 80 },
      // After b rises to 120, seller a (130) is no longer the cheapest.
      { date: '2026-10-06', minPrice: 120 },
    ]);
  });

  it('ignores sold-out points until the seller is back in stock', () => {
    const points = buildPricePoints([
      series('a', [
        ['2026-10-01', 100],
        ['2026-10-05', 100],
      ]),
      series('b', [
        ['2026-10-02', 70],
        ['2026-10-03', 70, 'OutOfStock'],
        ['2026-10-04', 75, 'LowStock'],
      ]),
    ]);

    expect(points).toEqual([
      { date: '2026-10-01', minPrice: 100 },
      { date: '2026-10-02', minPrice: 70 },
      { date: '2026-10-03', minPrice: 100 },
      { date: '2026-10-04', minPrice: 75 },
      { date: '2026-10-05', minPrice: 75 },
    ]);
  });

  it('skips days where nobody has stock', () => {
    const points = buildPricePoints([
      series('a', [
        ['2026-10-01', 100, 'OutOfStock'],
        ['2026-10-02', 100],
      ]),
    ]);

    expect(points).toEqual([{ date: '2026-10-02', minPrice: 100 }]);
  });
});

describe('buildChartGeometry', () => {
  const layout = { width: 120, height: 34, paddingX: 2, paddingTop: 4, paddingBottom: 4 };

  it('is empty without points', () => {
    expect(buildChartGeometry([], layout)).toMatchObject({ path: '', last: null, lowY: null });
  });

  it('draws a stepped line: horizontal to the next date, then vertical to the new price', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', minPrice: 200 },
        { date: '2026-10-11', minPrice: 100 },
        { date: '2026-10-21', minPrice: 150 },
      ],
      layout,
    );

    // plot: x 2..118, y 4..30 (200 at the top, 100 at the bottom)
    expect(geometry.path).toBe('M2 4 H60 V30 H118 V17');
    expect(geometry.last).toEqual({ x: 118, y: 17 });
    expect(geometry.lowY).toBe(30);
    expect(geometry.minPrice).toBe(100);
    expect(geometry.maxPrice).toBe(200);
  });

  it('places points proportionally in time, not evenly', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', minPrice: 200 },
        { date: '2026-10-02', minPrice: 100 },
        { date: '2026-10-11', minPrice: 100 },
      ],
      layout,
    );

    expect(geometry.path).toBe('M2 4 H13.6 V30 H118 V30');
  });

  it('centers a flat series vertically', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', minPrice: 100 },
        { date: '2026-10-05', minPrice: 100 },
      ],
      layout,
    );

    expect(geometry.path).toBe('M2 17 H118 V17');
    expect(geometry.lowY).toBe(17);
  });

  it('draws a single point as a line across the box ending in the dot', () => {
    const geometry = buildChartGeometry([{ date: '2026-10-01', minPrice: 100 }], layout);

    expect(geometry.path).toBe('M2 17 H118');
    expect(geometry.last).toEqual({ x: 118, y: 17 });
  });

  it('extends the price range down to a lower 90-day low', () => {
    const geometry = buildChartGeometry(
      [
        { date: '2026-10-01', minPrice: 200 },
        { date: '2026-10-11', minPrice: 150 },
      ],
      layout,
      100,
    );

    expect(geometry.minPrice).toBe(100);
    expect(geometry.lowY).toBe(30);
    // 150 sits halfway between 200 (top) and 100 (bottom).
    expect(geometry.last?.y).toBe(17);
  });
});
