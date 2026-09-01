const { calculateNextStreak, getJordanDate } = require('../src/utils/studentStreak');

describe('student daily streak rules', () => {
  test('counts only once for multiple activities on the same Jordan day', () => {
    expect(calculateNextStreak(4, '2026-09-01', '2026-09-01')).toBe(4);
  });

  test('increments after activity on the consecutive Jordan day', () => {
    expect(calculateNextStreak(4, '2026-09-01', '2026-09-02')).toBe(5);
  });

  test('resets to one after a missed Jordan day', () => {
    expect(calculateNextStreak(4, '2026-09-01', '2026-09-03')).toBe(1);
  });

  test('uses the Asia/Amman calendar day', () => {
    expect(getJordanDate(new Date('2026-09-01T21:30:00.000Z'))).toBe('2026-09-02');
  });
});
