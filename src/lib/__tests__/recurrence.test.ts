import { describe, it, expect } from 'vitest';
import { expandRecurrence, DAYS_OF_WEEK } from '../recurrence';

// 2026-07-06 is a Monday
describe('expandRecurrence', () => {
    it('includes only the requested weekdays', () => {
        const { dates, truncated } = expandRecurrence('2026-07-06', ['mon', 'wed'], '2026-07-19', 90);

        expect(dates).toEqual(['2026-07-06', '2026-07-08', '2026-07-13', '2026-07-15']);
        expect(truncated).toBe(false);
    });

    it('treats until as inclusive', () => {
        const { dates } = expandRecurrence('2026-07-06', ['sun'], '2026-07-19', 90);

        expect(dates).toEqual(['2026-07-12', '2026-07-19']);
    });

    it('includes the start date itself when it matches', () => {
        const { dates } = expandRecurrence('2026-07-06', ['mon'], '2026-07-06', 90);

        expect(dates).toEqual(['2026-07-06']);
    });

    it('caps the expansion at capDays after the start date', () => {
        const { dates, truncated } = expandRecurrence('2026-01-01', [...DAYS_OF_WEEK], '2026-12-31', 10);

        expect(truncated).toBe(true);
        expect(dates).toHaveLength(11); // Jan 1 through Jan 11 inclusive
        expect(dates[0]).toBe('2026-01-01');
        expect(dates[dates.length - 1]).toBe('2026-01-11');
    });

    it('returns no dates when no weekday matches in the window', () => {
        // 2026-07-07 (Tue) through 2026-07-10 (Fri) contains no Sunday
        const { dates } = expandRecurrence('2026-07-07', ['sun'], '2026-07-10', 90);

        expect(dates).toEqual([]);
    });
});
