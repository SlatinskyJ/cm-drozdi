import { TZDate, tz } from '@date-fns/tz';
import { differenceInMinutes, format, startOfDay } from 'date-fns';

/**
 * The app's single display timezone. All users are in Czechia, so every date
 * is shown — and every date/time picked in a form is interpreted — as Prague
 * wall-clock time, regardless of the server's or the browser's timezone.
 * Dates travel through the API as plain UTC instants.
 *
 * Because formatting never depends on the runtime's timezone, the
 * server-rendered and client-rendered output is identical (no hydration
 * mismatch).
 */
export const APP_TIME_ZONE = 'Europe/Prague';

/** date-fns `in` context: runs a date-fns function in {@link APP_TIME_ZONE}. */
export const appTz = tz(APP_TIME_ZONE);

/** Start of today in {@link APP_TIME_ZONE}. */
export function startOfTodayInAppTz(): TZDate {
	return startOfDay(TZDate.tz(APP_TIME_ZONE));
}

export function formatDuration(start: Date, end: Date): string {
	const minutes = differenceInMinutes(end, start);
	const hours = Math.floor(minutes / 60);
	const remainder = String(minutes % 60).padStart(2, '0');
	return `${hours}:${remainder}`;
}

/** Formats an instant as `d. M. yyyy` in {@link APP_TIME_ZONE}. */
export function formatDate(date: Date): string {
	return format(date, 'd. M. yyyy', { in: appTz });
}

/** Formats an instant as `H:mm` in {@link APP_TIME_ZONE}. */
export function formatDateToTime(date: Date): string {
	return format(date, 'H:mm', { in: appTz });
}

/** Formats an instant as `d. M. yyyy HH:mm` in {@link APP_TIME_ZONE}. */
export function formatDateTime(date: Date): string {
	return format(date, 'd. M. yyyy HH:mm', { in: appTz });
}
