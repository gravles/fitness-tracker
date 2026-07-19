import { format, addDays } from 'date-fns';

export const DAYS_OF_WEEK = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

/**
 * Expand a weekday recurrence pattern into concrete YYYY-MM-DD dates from
 * startDate through until (inclusive), capped at capDays after startDate.
 * Same expansion the MCP schedule_workout / plan_meal tools perform inline;
 * inputs are assumed pre-validated (real dates, known weekday names).
 */
export function expandRecurrence(
    startDate: string,
    daysOfWeek: string[],
    until: string,
    capDays: number
): { dates: string[]; truncated: boolean } {
    const capEnd = format(addDays(new Date(startDate + 'T00:00:00'), capDays), 'yyyy-MM-dd');
    const truncated = until > capEnd;
    const end = truncated ? capEnd : until;

    const dates: string[] = [];
    for (let d = new Date(startDate + 'T00:00:00'); format(d, 'yyyy-MM-dd') <= end; d = addDays(d, 1)) {
        if (daysOfWeek.includes(DAYS_OF_WEEK[d.getDay()])) dates.push(format(d, 'yyyy-MM-dd'));
    }
    return { dates, truncated };
}
