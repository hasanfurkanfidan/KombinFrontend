import type { OfferSeries, StockStatus } from '@/api/models';
import { dayNumber } from '@/utils/dates';
import { toNumber } from '@/utils/money';

export interface ChartPoint {
  /** "YYYY-MM-DD" (UTC calendar day). */
  date: string;
  minPrice: number;
}

const SELLABLE: readonly StockStatus[] = ['InStock', 'LowStock'];

/**
 * Collapses the per-seller series into one "cheapest price on the market" line.
 *
 * The backend writes a snapshot only when something changed (or once a day), so a seller with no point on
 * a given day still has its previous price. Each seller's last known price is therefore carried forward,
 * and a sold-out point removes that seller from the minimum until it is back in stock.
 */
export function buildPricePoints(series: readonly OfferSeries[]): ChartPoint[] {
  const dates = [
    ...new Set(series.flatMap((offer) => offer.points.map((point) => point.date))),
  ].sort();

  const current = new Map<string, number | null>();
  const pointsByOffer = series.map((offer) => ({
    offerId: offer.offerId,
    byDate: new Map(offer.points.map((point) => [point.date, point])),
  }));

  const result: ChartPoint[] = [];
  for (const date of dates) {
    for (const { offerId, byDate } of pointsByOffer) {
      const point = byDate.get(date);
      if (point) {
        current.set(
          offerId,
          SELLABLE.includes(point.stockStatus) ? toNumber(point.minPrice) : null,
        );
      }
    }
    const prices = [...current.values()].filter((price): price is number => price !== null);
    if (prices.length > 0) {
      result.push({ date, minPrice: Math.min(...prices) });
    }
  }
  return result;
}

export interface ChartLayout {
  width: number;
  height: number;
  paddingX: number;
  paddingTop: number;
  paddingBottom: number;
}

export interface ChartGeometry {
  /** SVG path of the stepped line: each price holds until the next observation. */
  path: string;
  /** Position of the most recent point, for the accent dot. */
  last: { x: number; y: number } | null;
  /** Y of the dashed "lowest price" line. */
  lowY: number | null;
  minPrice: number;
  maxPrice: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** Maps price points onto an SVG box. `lowPrice` (the 90-day low) widens the price range if needed. */
export function buildChartGeometry(
  points: readonly ChartPoint[],
  layout: ChartLayout,
  lowPrice?: number,
): ChartGeometry {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last) {
    return { path: '', last: null, lowY: null, minPrice: 0, maxPrice: 0 };
  }

  const { width, height, paddingX, paddingTop, paddingBottom } = layout;
  const prices = points.map((point) => point.minPrice);
  const minPrice = Math.min(...prices, lowPrice ?? Infinity);
  const maxPrice = Math.max(...prices);
  const plotWidth = width - paddingX * 2;
  const plotHeight = height - paddingTop - paddingBottom;

  const startDay = dayNumber(first.date);
  const span = dayNumber(last.date) - startDay;

  const xFor = (date: string) =>
    span === 0 ? width - paddingX : paddingX + ((dayNumber(date) - startDay) / span) * plotWidth;
  const yFor = (price: number) =>
    maxPrice === minPrice
      ? paddingTop + plotHeight / 2
      : paddingTop + ((maxPrice - price) / (maxPrice - minPrice)) * plotHeight;

  const startX = span === 0 ? paddingX : xFor(first.date);
  let path = `M${round(startX)} ${round(yFor(first.minPrice))}`;
  for (const point of points.slice(1)) {
    path += ` H${round(xFor(point.date))} V${round(yFor(point.minPrice))}`;
  }
  if (span === 0) {
    path += ` H${round(width - paddingX)}`;
  }

  return {
    path,
    last: { x: round(xFor(last.date)), y: round(yFor(last.minPrice)) },
    lowY: round(yFor(minPrice)),
    minPrice,
    maxPrice,
  };
}
