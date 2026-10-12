import { format } from 'date-fns';
import { cs } from 'date-fns/locale';

/**
 * The app's display timezone: every date must be shown as Prague wall-clock
 * time, whatever timezone the server or the browser runs in.
 */
export const APP_TZ = 'Europe/Prague';

/**
 * Timezones the app server and the browser run in during e2e (see
 * playwright.config.ts). By default the server runs in UTC (as on Vercel) and
 * the browser in a non-Prague zone, so neither matches APP_TZ and any date
 * logic that leaks the runtime's timezone shows up as a wrong time or day.
 * Override with E2E_SERVER_TZ / E2E_BROWSER_TZ, e.g. both `Europe/Prague`.
 */
export const SERVER_TZ = process.env.E2E_SERVER_TZ ?? 'UTC';
export const BROWSER_TZ = process.env.E2E_BROWSER_TZ ?? 'America/New_York';

export type CalendarDay = { year: number; month: number; day: number };

/** Today's calendar date in APP_TZ, independent of the test runner's TZ. */
export function todayInAppTz(): CalendarDay {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(new Date());
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Calendar arithmetic on a day (no timezone involved). */
export function addDays(date: CalendarDay, days: number): CalendarDay {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

/** The Czech accessible name react-day-picker gives a day button. */
export function dayButtonName(date: CalendarDay): string {
  return format(new Date(date.year, date.month - 1, date.day), 'PPPP', {
    locale: cs,
  });
}

/** The Czech accessible name react-day-picker gives a month's grid. */
export function monthGridName(date: CalendarDay): string {
  return format(new Date(date.year, date.month - 1, 1), 'LLLL y', {
    locale: cs,
  });
}

/** `d. M. yyyy`, as the app displays dates. */
export function displayDate(date: CalendarDay): string {
  return `${date.day}. ${date.month}. ${date.year}`;
}

/** Wall-clock `yyyy-MM-dd HH:mm` of an instant in APP_TZ. */
export function wallClockInAppTz(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}
