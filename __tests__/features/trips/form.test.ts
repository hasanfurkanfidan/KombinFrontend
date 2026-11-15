import {
  DEFAULT_MAX_PIECES,
  buildTripRequest,
  defaultTripForm,
  validateTrip,
} from '@/features/trips/form';
import { coverageSentence, hasMissingPieces, tripWeatherText } from '@/features/trips/labels';
import { tr } from '@/i18n/tr';

import { packItem, tripDay, tripPlan } from '../../fixtures';

describe('the trip form defaults', () => {
  it('needs only a city and dates: everything else has a default', () => {
    const form = defaultTripForm('Roma');
    expect(form).toMatchObject({
      city: 'Roma',
      range: { start: null, end: null },
      occasions: {},
      maxPieces: DEFAULT_MAX_PIECES,
      allowRepeatShoes: true,
      laundry: false,
    });
    const ready = { ...form, range: { start: '2026-11-20', end: '2026-11-22' } };
    expect(validateTrip(ready)).toEqual({});
  });

  it('asks for the city and the dates, next to their fields', () => {
    expect(validateTrip(defaultTripForm())).toEqual({
      city: tr.tripCityRequired,
      dates: tr.tripDatesRequired,
    });
    // A blank city is no city.
    expect(
      validateTrip({ ...defaultTripForm('   '), range: { start: '2026-11-20', end: '2026-11-20' } })
        .city,
    ).toBe(tr.tripCityRequired);
  });

  it('refuses a range over 14 days, though the picker would not let it through', () => {
    const form = { ...defaultTripForm('Roma'), range: { start: '2026-11-20', end: '2026-12-05' } };
    expect(validateTrip(form).dates).toBe(tr.tripDatesRequired);
  });
});

describe('the trip request', () => {
  const form = {
    ...defaultTripForm('  Roma '),
    range: { start: '2026-11-20', end: '2026-11-22' },
  };

  it('trims the city and sends no plans when none were chosen', () => {
    expect(buildTripRequest(form, 'pe1')).toEqual({
      city: 'Roma',
      startDate: '2026-11-20',
      endDate: '2026-11-22',
      occasions: null,
      maxPieces: 20,
      allowRepeatShoes: true,
      laundry: false,
      personaId: 'pe1',
    });
  });

  it('sends the plans in date order and drops those outside the range', () => {
    const request = buildTripRequest({
      ...form,
      occasions: { '2026-11-22': 'evening', '2026-11-20': 'office', '2026-12-30': 'sport' },
    });
    expect(request.occasions).toEqual([
      { date: '2026-11-20', occasion: 'office' },
      { date: '2026-11-22', occasion: 'evening' },
    ]);
    expect(request.personaId).toBeNull();
  });
});

describe('reading a plan', () => {
  it('says the coverage as a sentence, with the number read the Turkish way', () => {
    expect(coverageSentence({ covered: 6, total: 7, percent: 86 })).toBe("7 günün 6'sı hazır");
    expect(coverageSentence({ covered: 14, total: 14, percent: 100 })).toBe("14 günün 14'ü hazır");
    expect(coverageSentence({ covered: 0, total: 3, percent: 0 })).toBe("3 günün 0'ı hazır");
  });

  it('finds a missing piece in the packing list or in a day', () => {
    expect(hasMissingPieces(tripPlan())).toBe(false);
    expect(
      hasMissingPieces(
        tripPlan({ pieces: [{ slot: 'Top', items: [packItem({ missing: true })] }] }),
      ),
    ).toBe(true);
    const day = tripDay('2026-11-20');
    const pieces = day.outfit!.pieces.map((piece) => ({ ...piece, missing: true }));
    expect(
      hasMissingPieces(tripPlan({ days: [{ ...day, outfit: { ...day.outfit!, pieces } }] })),
    ).toBe(true);
  });

  it("says where a day's weather comes from when it is not a forecast", () => {
    const weather = tripDay('2026-11-20').weather;
    expect(tripWeatherText(weather)).toEqual({ text: '12° yağmurlu', note: null });
    expect(tripWeatherText({ ...weather, source: 'Normal' }).note).toBe(tr.tripWeatherNormal);
    expect(
      tripWeatherText({ ...weather, source: 'Season', temperatureC: null, band: null }),
    ).toEqual({ text: tr.tripWeatherSeason, note: null });
  });
});
