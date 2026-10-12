import { differenceInMinutes, format } from 'date-fns';

/**
 * Dates returned from tRPC procedures are shifted by `dateMiddleware`
 * (src/server/api/trpc.ts) so that their **UTC** fields hold the server's
 * local wall-clock time. This rebuilds that wall-clock time as a regular
 * local `Date`, so date-fns / react-day-picker (which read local fields) see
 * the same day and time regardless of the runtime's timezone. That keeps the
 * server-rendered and client-rendered output identical (no hydration
 * mismatch), and — when the browser shares the server's timezone — yields the
 * original instant, so it can be sent back to the server unchanged.
 */
export function toWallClockDate(date: Date): Date {
	return new Date(
		date.getUTCFullYear(),
		date.getUTCMonth(),
		date.getUTCDate(),
		date.getUTCHours(),
		date.getUTCMinutes(),
		date.getUTCSeconds(),
		date.getUTCMilliseconds(),
	);
}

export function formatDuration(start: Date, end: Date): string {
	const minutes = differenceInMinutes(end, start);
	const hours = Math.floor(minutes / 60);
	const remainder = String(minutes % 60).padStart(2, '0');
	return `${hours}:${remainder}`;
}

/** Formats a tRPC-returned (middleware-shifted) date as `d. M. yyyy`. */
export function formatDate(date: Date): string {
	return format(toWallClockDate(date), 'd. M. yyyy');
}

/** Formats a tRPC-returned (middleware-shifted) date as `H:mm`. */
export function formatDateToTime(date: Date): string {
	return format(toWallClockDate(date), 'H:mm');
}
