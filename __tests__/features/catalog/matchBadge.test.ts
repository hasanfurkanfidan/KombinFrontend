import { MATCH_BADGE_MIN, matchBadgeScore } from '@/features/catalog/matchBadge';
import { buildGreeting } from '@/features/catalog/greeting';

describe('match badge threshold', () => {
  it('shows scores from 40 up', () => {
    expect(MATCH_BADGE_MIN).toBe(40);
    expect(matchBadgeScore(40)).toBe(40);
    expect(matchBadgeScore(94)).toBe(94);
    expect(matchBadgeScore('89')).toBe(89);
  });

  it('hides bad scores and missing ones', () => {
    expect(matchBadgeScore(39)).toBeNull();
    expect(matchBadgeScore(0)).toBeNull();
    expect(matchBadgeScore(null)).toBeNull();
    expect(matchBadgeScore(undefined)).toBeNull();
  });

  it('rounds before comparing', () => {
    expect(matchBadgeScore(39.6)).toBe(40);
    expect(matchBadgeScore(39.4)).toBeNull();
  });
});

describe('greeting by local hour', () => {
  const at = (hour: number) => new Date(2026, 10, 1, hour, 30);

  it('says günaydın in the morning, iyi günler in the afternoon and iyi akşamlar in the evening', () => {
    expect(buildGreeting(at(5), 'Furkan')).toBe('Günaydın, Furkan');
    expect(buildGreeting(at(11), 'Furkan')).toBe('Günaydın, Furkan');
    expect(buildGreeting(at(12), 'Furkan')).toBe('İyi günler, Furkan');
    expect(buildGreeting(at(17), 'Furkan')).toBe('İyi günler, Furkan');
    expect(buildGreeting(at(18), 'Furkan')).toBe('İyi akşamlar, Furkan');
    expect(buildGreeting(at(23), 'Furkan')).toBe('İyi akşamlar, Furkan');
    expect(buildGreeting(at(3), 'Furkan')).toBe('İyi akşamlar, Furkan');
  });

  it('uses the first name only, and no name while it is unknown', () => {
    expect(buildGreeting(at(20), 'Ayşe Yılmaz')).toBe('İyi akşamlar, Ayşe');
    expect(buildGreeting(at(20), undefined)).toBe('İyi akşamlar');
    expect(buildGreeting(at(20), '   ')).toBe('İyi akşamlar');
  });
});
